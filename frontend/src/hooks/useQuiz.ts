/**
 * Quiz state management hook — tracks quiz progress across scenes.
 */
import { useState, useRef, useCallback } from 'react';
import type { QuizQuestion, QuizAnswer, QuizResults, SceneQuiz } from '../types/lesson';

export type QuizState = 'idle' | 'intro' | 'reading' | 'waiting' | 'answered' | 'reveal';

interface UseQuizOptions {
  quizzes: SceneQuiz[];
  onSendAnswer: (scene: number, questionIndex: number, selected: string | null) => void;
}

export function useQuiz({ quizzes, onSendAnswer }: UseQuizOptions) {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [currentScene, setCurrentScene] = useState(-1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [sceneAnswers, setSceneAnswers] = useState<QuizAnswer[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerSentRef = useRef(false);
  // Buffer next question events that arrive while showing the "answered" state
  const pendingReadingRef = useRef<{ scene: number; questionIndex: number } | null>(null);
  const answerDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quizStateRef = useRef<QuizState>(quizState);
  quizStateRef.current = quizState;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearAnswerDisplayTimer = useCallback(() => {
    if (answerDisplayTimerRef.current) {
      clearTimeout(answerDisplayTimerRef.current);
      answerDisplayTimerRef.current = null;
    }
  }, []);

  const transitionToReading = useCallback(
    (scene: number, questionIndex: number) => {
      console.log(`[Quiz] Transitioning to reading: scene=${scene} Q${questionIndex}`);
      setCurrentQuestionIndex(questionIndex);
      setSelectedOption(null);
      answerSentRef.current = false;
      pendingReadingRef.current = null;
      setQuizState('reading');
    },
    [],
  );

  const submitAnswer = useCallback(
    (selected: string | null) => {
      if (answerSentRef.current) return;
      answerSentRef.current = true;
      clearTimer();

      const quiz = quizzes.find((q) => q.scene === currentScene);
      if (!quiz) {
        console.warn('[Quiz] No quiz found for scene', currentScene);
        return;
      }

      const q = quiz.questions[currentQuestionIndex];
      const isCorrect = selected === q.correct;

      console.log(
        `[Quiz] Answer submitted: scene=${currentScene} Q${currentQuestionIndex} selected=${selected} correct=${q.correct} isCorrect=${isCorrect}`,
      );

      const answer: QuizAnswer = {
        scene: currentScene,
        questionIndex: currentQuestionIndex,
        selected,
        correct: q.correct,
        isCorrect,
      };

      setSceneAnswers((prev) => [...prev, answer]);
      setSelectedOption(selected);

      // Transition to "answered" state — show selection for 1.5s before allowing next question
      setQuizState('answered');

      // Send to backend
      onSendAnswer(currentScene, currentQuestionIndex, selected);

      // After 1.5s, process any buffered next question
      clearAnswerDisplayTimer();
      answerDisplayTimerRef.current = setTimeout(() => {
        const pending = pendingReadingRef.current;
        if (pending) {
          transitionToReading(pending.scene, pending.questionIndex);
        }
        // If no pending, we stay in 'answered' state until quiz_question arrives
      }, 1500);
    },
    [currentScene, currentQuestionIndex, quizzes, onSendAnswer, clearTimer, clearAnswerDisplayTimer, transitionToReading],
  );

  const startTimer = useCallback(() => {
    setTimeRemaining(15);
    answerSentRef.current = false;
    setSelectedOption(null);
    setQuizState('waiting');

    clearTimer();
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, 15 - elapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        console.log('[Quiz] Timer expired, auto-submitting null');
        submitAnswer(null);
      }
    }, 1000);
  }, [clearTimer, submitAnswer]);

  const startSceneQuiz = useCallback(
    (scene: number, questions: QuizQuestion[]) => {
      console.log(`[Quiz] Starting quiz for scene ${scene} with ${questions.length} questions`);
      setCurrentScene(scene);
      setCurrentQuestionIndex(0);
      setCurrentQuestions(questions);
      setSceneAnswers([]);
      setSelectedOption(null);
      answerSentRef.current = false;
      pendingReadingRef.current = null;
      clearAnswerDisplayTimer();
      setQuizState('intro');
    },
    [clearAnswerDisplayTimer],
  );

  const setQuestionReading = useCallback(
    (scene: number, questionIndex: number) => {
      const currentState = quizStateRef.current;
      console.log(`[Quiz] quiz_question received: scene=${scene} Q${questionIndex}, current state=${currentState}`);

      // If we're in 'answered' or 'waiting' state, buffer this transition
      if (currentState === 'answered' || currentState === 'waiting') {
        console.log('[Quiz] Buffering next question (showing answer feedback)');
        pendingReadingRef.current = { scene, questionIndex };
        return;
      }

      transitionToReading(scene, questionIndex);
    },
    [transitionToReading],
  );

  const setQuestionReady = useCallback(
    (_scene: number, questionIndex: number) => {
      console.log(`[Quiz] quiz_question_ready: Q${questionIndex} — starting 15s timer`);
      startTimer();
    },
    [startTimer],
  );

  const selectOption = useCallback(
    (option: string) => {
      if (quizStateRef.current !== 'waiting' || answerSentRef.current) {
        console.log(`[Quiz] selectOption ignored: state=${quizStateRef.current} answerSent=${answerSentRef.current}`);
        return;
      }
      console.log(`[Quiz] Option selected: ${option}`);
      submitAnswer(option);
    },
    [submitAnswer],
  );

  const showBatchReveal = useCallback(
    (scene: number, serverAnswers: { question_index: number; selected: string | null; correct: string; is_correct: boolean }[]) => {
      console.log(`[Quiz] Batch reveal for scene ${scene}:`, serverAnswers);
      clearTimer();
      clearAnswerDisplayTimer();
      pendingReadingRef.current = null;
      setQuizState('reveal');

      // Use server answers as source of truth
      const newSceneAnswers: QuizAnswer[] = serverAnswers.map((a) => ({
        scene,
        questionIndex: a.question_index,
        selected: a.selected,
        correct: a.correct,
        isCorrect: a.is_correct,
      }));
      setSceneAnswers(newSceneAnswers);
      setAnswers((prev) => [...prev, ...newSceneAnswers]);
    },
    [clearTimer, clearAnswerDisplayTimer],
  );

  const endQuiz = useCallback(
    (serverResults?: {
      total_questions: number;
      correct_count: number;
      score: number;
      passed: boolean;
      per_scene: { scene: number; scene_title: string; correct: number; total: number }[];
      answers: { scene: number; question_index: number; selected: string | null; correct: string; is_correct: boolean }[];
    }) => {
      clearTimer();
      clearAnswerDisplayTimer();
      pendingReadingRef.current = null;
      setQuizState('idle');

      if (serverResults) {
        console.log(`[Quiz] Final results: score=${serverResults.score}% (${serverResults.correct_count}/${serverResults.total_questions})`);
        setResults({
          totalQuestions: serverResults.total_questions,
          correctCount: serverResults.correct_count,
          score: serverResults.score,
          passed: serverResults.passed,
          perScene: serverResults.per_scene.map((s) => ({
            scene: s.scene,
            sceneTitle: s.scene_title,
            correct: s.correct,
            total: s.total,
          })),
          answers: serverResults.answers.map((a) => ({
            scene: a.scene,
            questionIndex: a.question_index,
            selected: a.selected,
            correct: a.correct,
            isCorrect: a.is_correct,
          })),
        });
      } else if (answers.length > 0) {
        // Compute locally from accumulated answers
        const allAnswers = answers;
        const total = allAnswers.length;
        const correct = allAnswers.filter((a) => a.isCorrect).length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        console.log(`[Quiz] Final results (local): score=${score}% (${correct}/${total})`);

        const sceneMap = new Map<number, { scene: number; sceneTitle: string; correct: number; total: number }>();
        for (const a of allAnswers) {
          const existing = sceneMap.get(a.scene);
          if (existing) {
            existing.total++;
            if (a.isCorrect) existing.correct++;
          } else {
            const quiz = quizzes.find((q) => q.scene === a.scene);
            sceneMap.set(a.scene, {
              scene: a.scene,
              sceneTitle: quiz?.scene_title || `Scene ${a.scene + 1}`,
              correct: a.isCorrect ? 1 : 0,
              total: 1,
            });
          }
        }

        setResults({
          totalQuestions: total,
          correctCount: correct,
          score,
          passed: score >= 70,
          perScene: Array.from(sceneMap.values()),
          answers: allAnswers,
        });
      }
    },
    [clearTimer, clearAnswerDisplayTimer, answers, quizzes],
  );

  const dismissReveal = useCallback(() => {
    console.log('[Quiz] Dismissing reveal overlay');
    setQuizState('idle');
    setSceneAnswers([]);
    setSelectedOption(null);
  }, []);

  return {
    quizState,
    currentScene,
    currentQuestionIndex,
    currentQuestions,
    timeRemaining,
    selectedOption,
    answers,
    sceneAnswers,
    results,
    startSceneQuiz,
    setQuestionReading,
    setQuestionReady,
    selectOption,
    showBatchReveal,
    dismissReveal,
    endQuiz,
  };
}
