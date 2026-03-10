/**
 * Voice session hook — manages WebSocket connection to the voice narration endpoint
 * and audio playback (24kHz). Listen-only: no mic capture.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceStatus = 'idle' | 'connecting' | 'narrating' | 'complete' | 'error';

interface Transcript {
  role: string;
  text: string;
}

interface UseVoiceSessionOptions {
  onAdvanceStep?: (step: number) => void;
  onNarrationComplete?: () => void;
}

export function useVoiceSession(options: UseVoiceSessionOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [currentNarrationStep, setCurrentNarrationStep] = useState(-1);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track current model transcript accumulation
  const currentModelTextRef = useRef('');

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    playbackNodeRef.current = null;
  }, []);

  const startSession = useCallback(
    async (lesson: Record<string, unknown>) => {
      if (wsRef.current) return;

      setStatus('connecting');
      setTranscript([]);
      setLiveTranscript('');
      setCurrentNarrationStep(-1);
      currentModelTextRef.current = '';

      try {
        // 1. Playback AudioContext at 24kHz
        const playbackCtx = new AudioContext({ sampleRate: 24000 });
        playbackCtxRef.current = playbackCtx;
        await playbackCtx.audioWorklet.addModule('/audio-playback.js');
        const playbackNode = new AudioWorkletNode(playbackCtx, 'pcm-player-processor');
        playbackNode.connect(playbackCtx.destination);
        playbackNodeRef.current = playbackNode;

        // 2. WebSocket
        const sessionId = 'voice-' + Date.now();
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws/voice/${sessionId}`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'start_lesson', lesson }));
          setStatus('narrating');
        };

        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Audio from Gemini → playback worklet
            playbackNodeRef.current?.port.postMessage(event.data);
          } else {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'advance_step':
                setCurrentNarrationStep(msg.step);
                // Finalize any accumulated transcript
                if (currentModelTextRef.current) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: 'model', text: currentModelTextRef.current },
                  ]);
                  currentModelTextRef.current = '';
                }
                setLiveTranscript('');
                optionsRef.current.onAdvanceStep?.(msg.step);
                break;

              case 'transcript':
                if (msg.role === 'model') {
                  currentModelTextRef.current += msg.text;
                  setLiveTranscript(currentModelTextRef.current);
                }
                break;

              case 'interrupted':
                // Flush playback buffer
                playbackNodeRef.current?.port.postMessage({ command: 'endOfAudio' });
                break;

              case 'turn_complete':
                // Transcript accumulation finalized on next advance_step
                break;

              case 'narration_complete':
                // Finalize last transcript
                if (currentModelTextRef.current) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: 'model', text: currentModelTextRef.current },
                  ]);
                  currentModelTextRef.current = '';
                }
                setStatus('complete');
                optionsRef.current.onNarrationComplete?.();
                break;

              case 'error':
                console.error('Voice error:', msg.message);
                setStatus('error');
                break;
            }
          }
        };

        ws.onerror = () => {
          setStatus('error');
        };

        ws.onclose = () => {
          if (status !== 'complete' && status !== 'error') {
            setStatus('idle');
          }
        };
      } catch (err) {
        console.error('Voice session start error:', err);
        setStatus('error');
        cleanup();
      }
    },
    [cleanup],
  );

  const stopSession = useCallback(() => {
    cleanup();
    setStatus('idle');
    setLiveTranscript('');
    currentModelTextRef.current = '';
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    currentNarrationStep,
    transcript,
    liveTranscript,
    startSession,
    stopSession,
  };
}
