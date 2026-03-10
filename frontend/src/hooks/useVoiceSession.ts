/**
 * Voice session hook — manages WebSocket connection to the voice narration endpoint
 * and audio playback (24kHz). Listen-only: no mic capture.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { QuizQuestion } from '../types/lesson';

export type VoiceStatus = 'idle' | 'connecting' | 'narrating' | 'complete' | 'error';

interface Transcript {
  role: string;
  text: string;
}

interface QuizResultAnswer {
  scene: number;
  question_index: number;
  selected: string | null;
  correct: string;
  is_correct: boolean;
}

export interface ServerQuizResults {
  total_questions: number;
  correct_count: number;
  score: number;
  passed: boolean;
  per_scene: { scene: number; scene_title: string; correct: number; total: number }[];
  answers: QuizResultAnswer[];
}

interface UseVoiceSessionOptions {
  onAdvanceStep?: (step: number) => void;
  onNarrationComplete?: (quizResults?: ServerQuizResults) => void;
  onStartQuiz?: (scene: number, questions: QuizQuestion[]) => void;
  onQuizQuestion?: (scene: number, questionIndex: number) => void;
  onQuizQuestionReady?: (scene: number, questionIndex: number) => void;
  onQuizResults?: (scene: number, answers: QuizResultAnswer[]) => void;
  onTurnComplete?: () => void;
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

  const sendQuizAnswer = useCallback(
    (scene: number, questionIndex: number, selected: string | null) => {
      console.log(`[Voice] Sending quiz_answer: scene=${scene} Q${questionIndex} selected=${selected}`);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'quiz_answer',
            scene,
            question_index: questionIndex,
            selected,
          }),
        );
      }
    },
    [],
  );

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
                console.log(`[Voice] advance_step: ${msg.step}`);
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
                console.log('[Voice] interrupted');
                playbackNodeRef.current?.port.postMessage({ command: 'endOfAudio' });
                break;

              case 'turn_complete':
                console.log('[Voice] turn_complete');
                optionsRef.current.onTurnComplete?.();
                break;

              case 'start_quiz':
                console.log(`[Voice] start_quiz: scene=${msg.scene}, ${msg.questions?.length} questions`);
                optionsRef.current.onStartQuiz?.(msg.scene, msg.questions);
                break;

              case 'quiz_question':
                console.log(`[Voice] quiz_question: scene=${msg.scene} Q${msg.question_index}`);
                optionsRef.current.onQuizQuestion?.(msg.scene, msg.question_index);
                break;

              case 'quiz_question_ready':
                console.log(`[Voice] quiz_question_ready: scene=${msg.scene} Q${msg.question_index}`);
                optionsRef.current.onQuizQuestionReady?.(msg.scene, msg.question_index);
                break;

              case 'quiz_results':
                console.log(`[Voice] quiz_results: scene=${msg.scene}`, msg.answers);
                optionsRef.current.onQuizResults?.(msg.scene, msg.answers);
                break;

              case 'narration_complete':
                console.log('[Voice] narration_complete', msg.quiz_results ? `score=${msg.quiz_results.score}%` : 'no quiz');
                // Finalize last transcript
                if (currentModelTextRef.current) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: 'model', text: currentModelTextRef.current },
                  ]);
                  currentModelTextRef.current = '';
                }
                setStatus('complete');
                optionsRef.current.onNarrationComplete?.(msg.quiz_results ?? undefined);
                break;

              case 'error':
                console.error('Voice error:', msg.message);
                setStatus('error');
                break;
            }
          }
        };

        ws.onerror = () => {
          console.error('[Voice] WebSocket error');
          setStatus('error');
        };

        ws.onclose = (ev) => {
          console.log(`[Voice] WebSocket closed: code=${ev.code}`);
          if (status !== 'complete' && status !== 'error') {
            setStatus('error');
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
    sendQuizAnswer,
  };
}
