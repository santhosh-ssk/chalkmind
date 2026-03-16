import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLesson } from '../hooks/useLesson';
import { usePlayback } from '../hooks/usePlayback';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { useQuiz } from '../hooks/useQuiz';
import type { ServerQuizResults } from '../hooks/useVoiceSession';
import type { QuizQuestion } from '../types/lesson';
import { trackEvent } from '../utils/analytics';
import ChalkboardCanvas from '../components/board/ChalkboardCanvas';
import QuizOverlay from '../components/quiz/QuizOverlay';
import ScoreSlide from '../components/score/ScoreSlide';

const LOADING_STAGES = [
  { msg: 'Researching the topic...', icon: '🔍', pct: 10 },
  { msg: 'Reading through sources...', icon: '📚', pct: 25 },
  { msg: 'Designing the whiteboard...', icon: '🎨', pct: 40 },
  { msg: 'Sketching diagrams...', icon: '✏️', pct: 55 },
  { msg: 'Adding visual details...', icon: '✨', pct: 70 },
  { msg: 'Writing narration...', icon: '🎙️', pct: 85 },
  { msg: 'Almost there... grab a coffee ☕', icon: '☕', pct: 95 },
];

export default function BoardPage() {
  const { topic: rawTopic } = useParams<{ topic: string }>();
  const topic = decodeURIComponent(rawTopic || '');
  const navigate = useNavigate();
  const location = useLocation();

  // Read personalization from router state, fall back to defaults
  const routerState = (location.state || {}) as {
    name?: string;
    ageGroup?: string;
    difficulty?: string;
    recaptchaToken?: string;
  };
  const learnerName = routerState.name || 'Learner';
  const ageGroup = routerState.ageGroup || '18-40';
  const difficulty = routerState.difficulty || 'beginner';
  const recaptchaToken = routerState.recaptchaToken || '';

  const lessonState = useLesson({
    topic,
    name: learnerName,
    ageGroup,
    difficulty,
    recaptchaToken,
  });
  const totalSteps = lessonState.status === 'success' ? lessonState.lesson.steps.length : 0;
  const { currentStep, stepProgress, isPlaying, speed, pause, resume, reset, jumpTo, setStep, setSpeed } =
    usePlayback(totalSteps);

  // Voice session — drives playback via setStep
  const [voiceMode, setVoiceMode] = useState<'pending' | 'active' | 'fallback' | 'complete'>('pending');
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [showScore, setShowScore] = useState(false);
  const voiceStartedRef = useRef(false);
  const activeStepRef = useRef<HTMLDivElement>(null);
  const pendingStepRef = useRef<number | null>(null);

  // Quiz hook — needs quizzes from lesson + sendQuizAnswer from voice
  const quizzes = lessonState.status === 'success' ? (lessonState.lesson.quizzes ?? []) : [];

  // Use ref to break circular dependency: quiz needs voice.sendQuizAnswer, voice needs quiz callbacks
  const voiceRef = useRef<{ sendQuizAnswer: (scene: number, qi: number, sel: string | null) => void } | null>(null);

  const onSendAnswer = useCallback(
    (scene: number, questionIndex: number, selected: string | null) => {
      voiceRef.current?.sendQuizAnswer(scene, questionIndex, selected);
    },
    [],
  );

  const quiz = useQuiz({ quizzes, onSendAnswer });

  // Voice session callbacks
  const onAdvanceStep = useCallback(
    (step: number) => {
      // When paused, buffer the step instead of animating it
      if (playbackState === 'paused') {
        pendingStepRef.current = step;
        return;
      }
      setStep(step);
    },
    [setStep, playbackState],
  );

  const onNarrationComplete = useCallback(
    (quizResults?: ServerQuizResults) => {
      setVoiceMode('complete');
      setPlaybackState('idle');
      quiz.endQuiz(quizResults);
      if (quizResults) {
        setShowScore(true);
      }
    },
    [quiz],
  );

  const onStartQuiz = useCallback(
    (scene: number, questions: QuizQuestion[]) => {
      quiz.startSceneQuiz(scene, questions);
    },
    [quiz],
  );

  const onQuizQuestion = useCallback(
    (scene: number, questionIndex: number) => {
      quiz.setQuestionReading(scene, questionIndex);
    },
    [quiz],
  );

  const onQuizQuestionReady = useCallback(
    (scene: number, questionIndex: number) => {
      quiz.setQuestionReady(scene, questionIndex);
    },
    [quiz],
  );

  const onQuizResults = useCallback(
    (scene: number, answers: { question_index: number; selected: string | null; correct: string; is_correct: boolean }[]) => {
      quiz.showBatchReveal(scene, answers);
    },
    [quiz],
  );

  const onTurnComplete = useCallback(() => {
    // Dismiss reveal overlay when agent finishes reveal narration and moves on
    if (quiz.quizState === 'reveal') {
      quiz.dismissReveal();
    }
  }, [quiz]);

  const voice = useVoiceSession({
    onAdvanceStep,
    onNarrationComplete,
    onStartQuiz,
    onQuizQuestion,
    onQuizQuestionReady,
    onQuizResults,
    onTurnComplete,
  });

  // Keep voiceRef in sync for quiz answer sending
  voiceRef.current = voice;

  // Auto-start voice when lesson loads
  useEffect(() => {
    if (lessonState.status === 'success' && !voiceStartedRef.current) {
      voiceStartedRef.current = true;
      voice.startSession(lessonState.lesson).then(() => {
        setVoiceMode('active');
        setPlaybackState('playing');
      });
    }
  }, [lessonState.status]);

  // Fall back to silent mode if voice errors — also dismiss any active quiz
  useEffect(() => {
    if (voice.status === 'error' && voiceMode !== 'fallback') {
      setVoiceMode('fallback');
      setPlaybackState('idle');
      if (quiz.quizState !== 'idle') {
        quiz.dismissReveal();
      }
    }
  }, [voice.status, voiceMode]);

  // Track lesson_error once when error state is reached
  const errorTracked = useRef(false);
  useEffect(() => {
    if (lessonState.status === 'error' && !errorTracked.current) {
      errorTracked.current = true;
      trackEvent('lesson_error', { topic, error: lessonState.message });
    }
  }, [lessonState.status, topic]);

  // Track lesson_completed when playback reaches the last step
  const completedTracked = useRef(false);
  useEffect(() => {
    if (totalSteps > 0 && currentStep >= totalSteps - 1 && !isPlaying && !completedTracked.current) {
      completedTracked.current = true;
      trackEvent('lesson_completed', { topic, step_count: totalSteps });
    }
  }, [currentStep, isPlaying, totalSteps, topic]);

  // Auto-scroll sidebar to keep active step visible
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStep]);

  // Rotating loading messages + elapsed timer
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (lessonState.status !== 'loading') return;
    const msgInterval = setInterval(() => {
      setLoadingMsgIdx((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 5000);
    const tickInterval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => { clearInterval(msgInterval); clearInterval(tickInterval); };
  }, [lessonState.status]);

  /* ── Loading state ─────────────────────────────────── */
  if (lessonState.status === 'loading') {
    const stage = LOADING_STAGES[loadingMsgIdx];
    const progressPct = Math.min(100, Math.round((elapsed / 45) * 100));
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 12,
          background: '#111613',
          color: '#d4d0c8',
          fontFamily: "'Lexend', sans-serif",
          padding: '0 24px',
        }}
      >
        {/* Animated chalkboard SVG graphic */}
        <svg width="140" height="120" viewBox="0 0 140 120" style={{ marginBottom: 8 }}>
          {/* Board */}
          <rect x="10" y="10" width="120" height="90" rx="6" fill="#1a201a" stroke="#5a4a32" strokeWidth="3"/>
          <rect x="18" y="18" width="104" height="74" rx="3" fill="#223322"/>
          {/* Animated chalk lines */}
          <line x1="30" y1="40" x2="80" y2="40" stroke="#e8e4d9" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="50" strokeDashoffset="50" style={{ animation: 'chalkDraw1 2s ease forwards' }}/>
          <line x1="30" y1="55" x2="100" y2="55" stroke="#5cb85c" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="70" strokeDashoffset="70" style={{ animation: 'chalkDraw2 2s 0.8s ease forwards' }}/>
          <line x1="30" y1="70" x2="65" y2="70" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="35" strokeDashoffset="35" style={{ animation: 'chalkDraw3 2s 1.6s ease forwards' }}/>
          {/* Chalk piece */}
          <rect x="95" y="96" width="18" height="8" rx="2" fill="#e8e4d9" opacity="0.7"
            style={{ animation: 'chalkBob 2s ease-in-out infinite' }}/>
        </svg>

        {/* Main heading */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#e8e4d9',
            fontFamily: "'Caveat', cursive",
            textAlign: 'center',
          }}
        >
          Preparing your lesson, {learnerName}
        </div>

        {/* Topic */}
        <div style={{ fontSize: 18, color: '#8fb88f', textAlign: 'center' }}>
          "{topic}"
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          maxWidth: 320,
          height: 6,
          background: '#2a3a2a',
          borderRadius: 3,
          marginTop: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #5cb85c, #f5c842)',
            borderRadius: 3,
            transition: 'width 1s ease',
          }}/>
        </div>

        {/* Stage message */}
        <div style={{
          fontSize: 18,
          color: '#8fb88f',
          fontFamily: "'Caveat', cursive",
          fontWeight: 600,
          minHeight: 28,
          textAlign: 'center',
          transition: 'opacity 0.3s',
        }}>
          {stage.icon} {stage.msg}
        </div>

        {/* Time estimate + elapsed */}
        <div style={{ fontSize: 14, color: '#4a5a4a', textAlign: 'center', lineHeight: 1.6 }}>
          This usually takes about 45 seconds
          <br/>
          <span style={{ fontSize: 13, color: '#3a4a3a' }}>
            {elapsed}s elapsed
          </span>
        </div>

        {/* Fun tip */}
        <div style={{
          marginTop: 8,
          padding: '10px 20px',
          background: '#1a231a',
          borderRadius: 12,
          border: '1px solid #2a3a2a',
          fontSize: 14,
          color: '#706b60',
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 340,
        }}>
          {elapsed < 15
            ? 'Our AI is reading up on this topic just for you...'
            : elapsed < 30
            ? 'Good things take time — stretch your fingers!'
            : elapsed < 45
            ? 'Almost there... perfect time to grab a coffee'
            : "Putting on the finishing touches... hang tight!"}
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 16,
            padding: '10px 22px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid #2a3a2a',
            color: '#706b60',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          &larr; Go back
        </button>

        <style>{`
          @keyframes chalkDraw1 {
            to { stroke-dashoffset: 0; }
          }
          @keyframes chalkDraw2 {
            to { stroke-dashoffset: 0; }
          }
          @keyframes chalkDraw3 {
            to { stroke-dashoffset: 0; }
          }
          @keyframes chalkBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}</style>
      </div>
    );
  }

  /* ── Error state — redirect home (reCAPTCHA token is stale on refresh) ── */
  if (lessonState.status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 16,
          background: '#111613',
          color: '#d4d0c8',
          fontFamily: "'Lexend', sans-serif",
        }}
      >
        <div style={{ fontSize: 40 }}>⚠</div>
        <div style={{ fontSize: 18, color: '#e07050', maxWidth: 480, textAlign: 'center' }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 14, color: '#706b60', maxWidth: 400, textAlign: 'center' }}>
          {lessonState.message}
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 8,
            padding: '12px 28px',
            borderRadius: 8,
            background: '#2d5a3d',
            border: 'none',
            color: '#e8e4d9',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          ← Try again from homepage
        </button>
      </div>
    );
  }

  /* ── Score slide (post-completion) ──────────────────── */
  if (showScore && quiz.results) {
    return (
      <ScoreSlide
        results={quiz.results}
        topic={topic}
        learnerName={learnerName}
        onNewTopic={() => navigate('/')}
      />
    );
  }

  /* ── Lesson loaded ─────────────────────────────────── */
  const { lesson } = lessonState;
  const narration =
    currentStep >= 0 && currentStep < totalSteps ? lesson.steps[currentStep].narration : null;
  const currentSceneTitle =
    currentStep >= 0 && currentStep < totalSteps ? lesson.steps[currentStep].scene_title : null;

  // Group steps by scene for sidebar rendering
  const sceneGroups: { scene: number; title: string; steps: { idx: number; narration: string }[] }[] = [];
  let lastScene = -1;
  for (let i = 0; i < lesson.steps.length; i++) {
    const step = lesson.steps[i];
    if (step.scene !== lastScene) {
      sceneGroups.push({ scene: step.scene, title: step.scene_title, steps: [] });
      lastScene = step.scene;
    }
    sceneGroups[sceneGroups.length - 1].steps.push({ idx: i, narration: step.narration });
  }

  // Check if a scene has a quiz for sidebar indicator
  const scenesWithQuiz = new Set(quizzes.map((q) => q.scene));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#111613',
        color: '#d4d0c8',
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: '1px solid #2a2e2a',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              voice.stopSession();
              reset();
              navigate('/');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid #2a3a2a',
              color: '#706b60',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ← Back
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e4d9' }}>
            {lesson.title || topic}
          </div>
          {/* Voice activity indicator */}
          {voiceMode === 'active' && voice.status === 'narrating' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 12,
                background: '#1a2e1a',
                border: '1px solid #5cb85c44',
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#5cb85c',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: 10, color: '#5cb85c', fontWeight: 700, letterSpacing: 1 }}>
                LIVE
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              color: '#706b60',
              fontFamily: "'JetBrains Mono', monospace",
              marginRight: 4,
            }}
          >
            Speed
          </span>
          {[0.5, 1, 1.5, 2].map((s) => {
            const controlsLocked = playbackState === 'playing' || playbackState === 'paused';
            return (
              <button
                key={s}
                onClick={() => !controlsLocked && setSpeed(s)}
                disabled={controlsLocked}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: speed === s ? '#2d5a3d' : 'transparent',
                  border: `1px solid ${speed === s ? '#2d5a3d' : '#2a2e2a'}`,
                  color: speed === s ? '#7ee08a' : '#706b60',
                  cursor: controlsLocked ? 'not-allowed' : 'pointer',
                  opacity: controlsLocked ? 0.35 : 1,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {s}x
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar — scenes & steps */}
        <div
          style={{
            width: 250,
            flexShrink: 0,
            borderRight: '1px solid #2a2e2a',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
            <div
              style={{
                fontSize: 10,
                color: '#706b60',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              {lesson.scene_count > 1 ? `${lesson.scene_count} Scenes` : `Steps · ${totalSteps}`}
            </div>
            {sceneGroups.map((group) => (
              <div key={group.scene}>
                {/* Scene header */}
                {lesson.scene_count > 1 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#8fb88f',
                      fontWeight: 600,
                      padding: '8px 0 6px 0',
                      borderTop: group.scene > 0 ? '1px solid #2a2e2a' : 'none',
                      marginTop: group.scene > 0 ? 8 : 0,
                      letterSpacing: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {group.title}
                    {scenesWithQuiz.has(group.scene) && (
                      <span
                        style={{
                          fontSize: 9,
                          color: '#f5c842',
                          background: '#3a2d1a',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 700,
                        }}
                      >
                        QUIZ
                      </span>
                    )}
                  </div>
                )}
                {group.steps.map(({ idx, narration: stepNarration }) => {
                  const isActive = idx === currentStep;
                  const isDone = idx < currentStep;
                  const controlsLocked = playbackState === 'playing' || playbackState === 'paused';
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeStepRef : undefined}
                      onClick={() => !controlsLocked && jumpTo(idx)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        marginBottom: 4,
                        cursor: controlsLocked ? 'not-allowed' : 'pointer',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: isActive ? '#1a2e1e' : 'transparent',
                        border: `1px solid ${isActive ? '#2d5a3d44' : 'transparent'}`,
                        transition: 'all 0.15s',
                        opacity: controlsLocked && !isActive ? 0.5 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: isDone ? '#2d5a3d' : isActive ? '#7ee08a' : '#1e241e',
                          color: isDone ? '#7ee08a' : isActive ? '#111' : '#4a4e4a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {isDone ? '\u2713' : idx + 1}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                          color: isActive ? '#c8d8c8' : isDone ? '#6a7a6a' : '#4a5a4a',
                        }}
                      >
                        {stepNarration?.slice(0, 60)}
                        {(stepNarration?.length || 0) > 60 ? '\u2026' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Playback controls — Pause / Resume / Play + Restart */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #2a2e2a' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(() => {
                const isConnecting = voiceMode === 'pending' || (voiceMode === 'active' && voice.status === 'connecting');

                if (playbackState === 'playing') {
                  // Currently playing — show Pause
                  return (
                    <button
                      onClick={() => {
                        voice.pauseAudio();
                        pause();
                        setPlaybackState('paused');
                      }}
                      style={{
                        flex: 1,
                        padding: '11px',
                        borderRadius: 8,
                        background: '#3a2d1a',
                        border: 'none',
                        color: '#f0a050',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      {'\u23F8'} Pause
                    </button>
                  );
                }

                if (playbackState === 'paused') {
                  // Paused — show Resume
                  return (
                    <button
                      onClick={() => {
                        voice.resumeAudio();
                        // Apply any buffered step, otherwise resume current animation
                        if (pendingStepRef.current !== null) {
                          setStep(pendingStepRef.current);
                          pendingStepRef.current = null;
                        } else {
                          resume();
                        }
                        setPlaybackState('playing');
                      }}
                      style={{
                        flex: 1,
                        padding: '11px',
                        borderRadius: 8,
                        background: '#2d5a3d',
                        border: 'none',
                        color: '#e8e4d9',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      {'\u25B6'} Resume
                    </button>
                  );
                }

                // Idle — show Play (restart voice session)
                return (
                  <button
                    onClick={() => {
                      voice.stopSession();
                      voiceStartedRef.current = false;
                      reset();
                      pendingStepRef.current = null;
                      setVoiceMode('pending');
                      setPlaybackState('idle');
                      voice.startSession(lesson).then(() => {
                        setVoiceMode('active');
                        setPlaybackState('playing');
                      });
                    }}
                    disabled={isConnecting}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 8,
                      background: '#2d5a3d',
                      border: 'none',
                      color: '#e8e4d9',
                      cursor: isConnecting ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      opacity: isConnecting ? 0.4 : 1,
                    }}
                  >
                    {'\u25B6'} Play
                  </button>
                );
              })()}
              {/* Restart — always available */}
              <button
                onClick={() => {
                  voice.stopSession();
                  voiceStartedRef.current = false;
                  reset();
                  pendingStepRef.current = null;
                  setVoiceMode('pending');
                  setPlaybackState('idle');
                  voice.startSession(lesson).then(() => {
                    setVoiceMode('active');
                    setPlaybackState('playing');
                  });
                }}
                style={{
                  padding: '11px 14px',
                  borderRadius: 8,
                  background: '#1a1e1a',
                  border: '1px solid #2a2e2a',
                  color: '#706b60',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
                title="Restart Course"
              >
                {'\u21BA'}
              </button>
            </div>
          </div>
        </div>

        {/* Main board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Narration bar */}
          <div
            style={{
              minHeight: 58,
              maxHeight: 120,
              overflowY: 'auto',
              padding: '12px 22px',
              background: '#141a15',
              borderBottom: '1px solid #2a2e2a',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            {(() => {
              const isVoiceActive = voiceMode === 'active' && voice.status === 'narrating';
              const displayText = isVoiceActive && voice.liveTranscript
                ? voice.liveTranscript
                : narration;

              if (displayText) {
                return (
                  <>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: isVoiceActive
                          ? 'linear-gradient(135deg, #3d6a4d, #5cb85c)'
                          : 'linear-gradient(135deg, #2d5a3d, #4a9a6a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          animation: isVoiceActive || isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none',
                        }}
                      >
                        {isVoiceActive ? '\uD83D\uDD0A' : '\uD83C\uDF99'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          lineHeight: 1.55,
                          color: '#d4dcd4',
                          fontFamily: "'Caveat', cursive",
                          fontWeight: 500,
                        }}
                      >
                        "{displayText}"
                      </div>
                      {currentSceneTitle && lesson.scene_count > 1 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#5a6a5a',
                            marginTop: 2,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {currentSceneTitle}
                          {isVoiceActive && (
                            <span style={{ marginLeft: 8, color: '#5cb85c' }}>
                              voice narrating
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              }

              // No narration yet
              if (voice.status === 'connecting') {
                return (
                  <div style={{ fontSize: 13, color: '#f5c842', fontStyle: 'italic' }}>
                    Connecting voice...
                  </div>
                );
              }
              if (voiceMode === 'complete') {
                return (
                  <div style={{ fontSize: 13, color: '#5cb85c', fontStyle: 'italic' }}>
                    Lesson complete!
                  </div>
                );
              }
              return (
                <div style={{ fontSize: 13, color: '#4a4e4a', fontStyle: 'italic' }}>
                  {voiceMode === 'fallback'
                    ? 'Press Play to start (silent mode).'
                    : 'Starting voice narration...'}
                </div>
              );
            })()}
          </div>

          {/* Canvas */}
          <ChalkboardCanvas lesson={lesson} currentStep={currentStep} stepProgress={stepProgress} />

          {/* Quiz overlay */}
          <QuizOverlay
            quizState={quiz.quizState}
            currentQuestionIndex={quiz.currentQuestionIndex}
            currentQuestions={quiz.currentQuestions}
            timeRemaining={quiz.timeRemaining}
            selectedOption={quiz.selectedOption}
            sceneAnswers={quiz.sceneAnswers}
            onSelectOption={quiz.selectOption}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2e2a; border-radius: 3px; }
      `}</style>
    </div>
  );
}
