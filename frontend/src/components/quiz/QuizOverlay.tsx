/**
 * Full-screen quiz overlay — shows during quiz phases on top of the chalkboard.
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizQuestion, QuizAnswer } from '../../types/lesson';
import type { QuizState } from '../../hooks/useQuiz';

// 'answered' is shown like 'waiting' but with selection highlighted and options disabled

interface QuizOverlayProps {
  quizState: QuizState;
  currentQuestionIndex: number;
  currentQuestions: QuizQuestion[];
  timeRemaining: number;
  selectedOption: string | null;
  sceneAnswers: QuizAnswer[];
  onSelectOption: (option: string) => void;
}

const QUIZ_TIMER = Number(import.meta.env.VITE_QUIZ_TIMER_SECONDS) || 6;

function TimerRing({ seconds, total = QUIZ_TIMER }: { seconds: number; total?: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const dashOffset = circumference * (1 - progress);
  const color = seconds <= 5 ? '#e07050' : '#f5c842';

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={radius} fill="none" stroke="#2a3a2a" strokeWidth={4} />
      <circle
        cx={36}
        cy={36}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
      />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={20} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
        {seconds}
      </text>
    </svg>
  );
}

function OptionButton({
  option,
  isSelected,
  isCorrect,
  isRevealed,
  disabled,
  onClick,
}: {
  option: { label: string; text: string };
  isSelected: boolean;
  isCorrect: boolean;
  isRevealed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  let bg = '#1a2e1e';
  let border = '#2a3a2a';
  let textColor = '#e8e4d9';

  if (isRevealed) {
    if (isCorrect) {
      bg = '#1a3d1a';
      border = '#5cb85c';
      textColor = '#5cb85c';
    } else if (isSelected) {
      bg = '#3d1a1a';
      border = '#e07050';
      textColor = '#e07050';
    }
  } else if (isSelected) {
    bg = '#2a4a1a';
    border = '#f5c842';
    textColor = '#f5c842';
  }

  const scale = isSelected && !isRevealed ? 1.03 : 1;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      animate={{ scale }}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 18px',
        borderRadius: 12,
        background: bg,
        border: `2px solid ${border}`,
        color: textColor,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 15,
        fontFamily: "'Lexend', sans-serif",
        textAlign: 'left',
        opacity: disabled && !isRevealed && !isSelected ? 0.5 : 1,
        transition: 'all 0.2s',
        boxShadow: isSelected && !isRevealed ? '0 0 12px rgba(245, 200, 66, 0.3)' : 'none',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isRevealed && isCorrect ? '#5cb85c' : isRevealed && isSelected ? '#e07050' : '#2a3a2a',
          color: isRevealed && (isCorrect || isSelected) ? '#111' : '#e8e4d9',
          fontWeight: 700,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {isRevealed && isCorrect ? '\u2713' : isRevealed && isSelected && !isCorrect ? '\u2717' : option.label}
      </span>
      <span>{option.text}</span>
    </motion.button>
  );
}

export default function QuizOverlay({
  quizState,
  currentQuestionIndex,
  currentQuestions,
  timeRemaining,
  selectedOption,
  sceneAnswers,
  onSelectOption,
}: QuizOverlayProps) {
  if (quizState === 'idle') return null;

  const question = currentQuestions[currentQuestionIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(17, 22, 19, 0.92)',
          display: 'flex',
          alignItems: quizState === 'reveal' ? 'flex-start' : 'center',
          justifyContent: 'center',
          zIndex: 50,
          overflowY: quizState === 'reveal' ? 'auto' : 'hidden',
          paddingTop: quizState === 'reveal' ? 24 : 0,
          paddingBottom: quizState === 'reveal' ? 24 : 0,
        }}
      >
        {/* Intro state */}
        {quizState === 'intro' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ textAlign: 'center' }}
          >
            <div
              style={{
                fontSize: 42,
                fontFamily: "'Caveat', cursive",
                color: '#f5c842',
                fontWeight: 700,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              Quiz Time!
            </div>
            <div style={{ fontSize: 14, color: '#8fb88f', marginTop: 8 }}>
              Get ready...
            </div>
          </motion.div>
        )}

        {/* Reading + Waiting + Answered states (question displayed) */}
        {(quizState === 'reading' || quizState === 'waiting' || quizState === 'answered') && question && (
          <motion.div
            key={`q-${currentQuestionIndex}`}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              width: '100%',
              maxWidth: 560,
              padding: '0 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#706b60',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {currentQuestionIndex + 1} / {currentQuestions.length}
              </span>
              {quizState === 'waiting' && <TimerRing seconds={timeRemaining} />}
              {quizState === 'answered' && (
                <span style={{ fontSize: 13, color: '#5cb85c', fontWeight: 600 }}>
                  Locked in!
                </span>
              )}
              {quizState === 'reading' && (
                <span style={{ fontSize: 12, color: '#f5c842', fontStyle: 'italic' }}>
                  Reading question...
                </span>
              )}
            </div>

            {/* Question text */}
            <div
              style={{
                fontSize: 22,
                fontFamily: "'Caveat', cursive",
                color: '#e8e4d9',
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {question.question}
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {question.options.map((opt) => (
                <OptionButton
                  key={opt.label}
                  option={opt}
                  isSelected={selectedOption === opt.label}
                  isCorrect={false}
                  isRevealed={false}
                  disabled={quizState !== 'waiting'}
                  onClick={() => onSelectOption(opt.label)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Reveal state */}
        {quizState === 'reveal' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: 600,
              padding: '0 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontFamily: "'Caveat', cursive",
                color: '#f5c842',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              Results
            </div>

            {currentQuestions.map((q, idx) => {
              const answer = sceneAnswers[idx];
              const isCorrect = answer?.isCorrect ?? false;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.15 }}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: '#141a15',
                    border: `1px solid ${isCorrect ? '#5cb85c44' : '#e0705044'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isCorrect ? '#5cb85c' : '#e07050',
                        color: '#111',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {isCorrect ? '\u2713' : '\u2717'}
                    </span>
                    <span style={{ fontSize: 14, color: '#e8e4d9' }}>
                      {q.question}
                    </span>
                  </div>

                  {/* Show options with correct/incorrect highlighting */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt) => (
                      <OptionButton
                        key={opt.label}
                        option={opt}
                        isSelected={answer?.selected === opt.label}
                        isCorrect={opt.label === q.correct}
                        isRevealed={true}
                        disabled={true}
                        onClick={() => {}}
                      />
                    ))}
                  </div>

                  {q.explanation && (
                    <div style={{ fontSize: 12, color: '#8fb88f', marginTop: 8, fontStyle: 'italic' }}>
                      {q.explanation}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
