import { useState, useRef, useCallback, useEffect } from 'react';

const STEP_DURATION = 4500; // ms per step at 1x speed

export function usePlayback(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepProgress, setStepProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const animRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const playingRef = useRef(false);

  const cancelAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const animateStep = useCallback(
    (step: number) => {
      if (step >= totalSteps) {
        setIsPlaying(false);
        playingRef.current = false;
        return;
      }
      startRef.current = performance.now();
      setCurrentStep(step);

      const tick = (now: number) => {
        if (!playingRef.current) return;
        const elapsed = (now - startRef.current) * speed;
        const p = Math.min(elapsed / STEP_DURATION, 1);
        setStepProgress(p);

        if (p < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          const pauseMs = Math.max(2000 / speed, 500);
          setTimeout(() => {
            if (!playingRef.current) return;
            if (step < totalSteps - 1) {
              animateStep(step + 1);
            } else {
              setIsPlaying(false);
              playingRef.current = false;
            }
          }, pauseMs);
        }
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [totalSteps, speed],
  );

  const play = useCallback(() => {
    if (isPlaying || totalSteps === 0) return;
    let startFrom = currentStep < 0 ? 0 : currentStep >= totalSteps - 1 ? 0 : currentStep + 1;
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(-1);
      setStepProgress(0);
      startFrom = 0;
    }
    setIsPlaying(true);
    playingRef.current = true;
    animateStep(startFrom);
  }, [isPlaying, totalSteps, currentStep, animateStep]);

  const pause = useCallback(() => {
    cancelAnim();
    setIsPlaying(false);
    playingRef.current = false;
  }, [cancelAnim]);

  const reset = useCallback(() => {
    cancelAnim();
    setIsPlaying(false);
    playingRef.current = false;
    setCurrentStep(-1);
    setStepProgress(0);
  }, [cancelAnim]);

  const jumpTo = useCallback(
    (step: number) => {
      cancelAnim();
      setIsPlaying(false);
      playingRef.current = false;
      setCurrentStep(step);
      setStepProgress(1);
    },
    [cancelAnim],
  );

  // Voice-driven: externally set the current step (auto-animates progress)
  const setStep = useCallback(
    (step: number) => {
      cancelAnim();
      setCurrentStep(step);
      setStepProgress(0);
      // Animate this step's drawing progress
      startRef.current = performance.now();
      setIsPlaying(true);
      playingRef.current = true;
      const tick = (now: number) => {
        if (!playingRef.current) return;
        const elapsed = now - startRef.current;
        const p = Math.min(elapsed / STEP_DURATION, 1);
        setStepProgress(p);
        if (p < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          // Step drawing done — stay at progress=1, stop animating
          // (voice session will advance when narration completes)
          setIsPlaying(false);
          playingRef.current = false;
        }
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [cancelAnim],
  );

  // Cleanup on unmount
  useEffect(() => cancelAnim, [cancelAnim]);

  return { currentStep, stepProgress, isPlaying, speed, play, pause, reset, jumpTo, setStep, setSpeed };
}
