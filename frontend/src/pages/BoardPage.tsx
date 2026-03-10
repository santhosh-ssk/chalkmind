import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLesson } from '../hooks/useLesson';
import { usePlayback } from '../hooks/usePlayback';
import ChalkboardCanvas from '../components/board/ChalkboardCanvas';

const LOADING_MESSAGES = [
  'Researching the topic...',
  'Designing the whiteboard...',
  'Adding visual details...',
  'Sketching diagrams...',
  'Writing narration...',
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
  const { currentStep, stepProgress, isPlaying, speed, play, pause, reset, jumpTo, setSpeed } =
    usePlayback(totalSteps);

  // Rotating loading messages
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (lessonState.status !== 'loading') return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [lessonState.status]);

  /* ── Loading state ─────────────────────────────────── */
  if (lessonState.status === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 20,
          background: '#111613',
          color: '#d4d0c8',
          fontFamily: "'Lexend', sans-serif",
        }}
      >
        <div style={{ position: 'relative', width: 60, height: 60 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: '3px solid #2a3a2a',
              borderTopColor: '#5cb85c',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 16,
            color: '#8fb88f',
            fontFamily: "'Caveat', cursive",
            fontWeight: 600,
          }}
        >
          Creating your lesson, {learnerName}...
        </div>
        <div style={{ fontSize: 14, color: '#e8e4d9' }}>"{topic}"</div>
        <div style={{ fontSize: 13, color: '#4a5a4a', minHeight: 20 }}>{LOADING_MESSAGES[loadingMsgIdx]}</div>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 12,
            padding: '8px 18px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid #2a3a2a',
            color: '#706b60',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          ← Go back
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────── */
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
        <div style={{ fontSize: 16, color: '#e07050', maxWidth: 480, textAlign: 'center' }}>
          {lessonState.message}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={lessonState.retry}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              background: '#2d5a3d',
              border: 'none',
              color: '#e8e4d9',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
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
            ← Go back
          </button>
        </div>
      </div>
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
          {[0.5, 1, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                background: speed === s ? '#2d5a3d' : 'transparent',
                border: `1px solid ${speed === s ? '#2d5a3d' : '#2a2e2a'}`,
                color: speed === s ? '#7ee08a' : '#706b60',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {s}x
            </button>
          ))}
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
                    }}
                  >
                    {group.title}
                  </div>
                )}
                {group.steps.map(({ idx, narration: stepNarration }) => {
                  const isActive = idx === currentStep;
                  const isDone = idx < currentStep;
                  return (
                    <div
                      key={idx}
                      onClick={() => jumpTo(idx)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        marginBottom: 4,
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: isActive ? '#1a2e1e' : 'transparent',
                        border: `1px solid ${isActive ? '#2d5a3d44' : 'transparent'}`,
                        transition: 'all 0.15s',
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
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                          color: isActive ? '#c8d8c8' : isDone ? '#6a7a6a' : '#4a5a4a',
                        }}
                      >
                        {stepNarration?.slice(0, 60)}
                        {(stepNarration?.length || 0) > 60 ? '…' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Playback controls */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #2a2e2a' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {!isPlaying ? (
                <button
                  onClick={play}
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
                  {currentStep >= totalSteps - 1 ? '⟲ Replay' : '▶ Play'}
                </button>
              ) : (
                <button
                  onClick={pause}
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
                  ⏸ Pause
                </button>
              )}
              <button
                onClick={reset}
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
              >
                ↺
              </button>
            </div>
          </div>
        </div>

        {/* Main board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Narration bar */}
          <div
            style={{
              minHeight: 58,
              padding: '12px 22px',
              background: '#141a15',
              borderBottom: '1px solid #2a2e2a',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            {narration ? (
              <>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #2d5a3d, #4a9a6a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      animation: isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }}
                  >
                    🎙
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
                    "{narration}"
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
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#4a4e4a', fontStyle: 'italic' }}>
                Press Play to start, or click any step.
              </div>
            )}
          </div>

          {/* Canvas */}
          <ChalkboardCanvas lesson={lesson} currentStep={currentStep} stepProgress={stepProgress} />
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
