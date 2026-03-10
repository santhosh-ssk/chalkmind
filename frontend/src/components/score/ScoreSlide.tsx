/**
 * Full-page end-of-lesson score display with per-scene breakdown.
 */
import { motion } from 'framer-motion';
import type { QuizResults } from '../../types/lesson';
import Certificate from './Certificate';
import { useState } from 'react';

interface ScoreSlideProps {
  results: QuizResults;
  topic: string;
  learnerName: string;
  onNewTopic: () => void;
}

function ScoreArc({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 100;
  const dashOffset = circumference * (1 - progress);
  const color = score >= 70 ? '#5cb85c' : '#f5c842';

  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={90} cy={90} r={radius} fill="none" stroke="#2a3a2a" strokeWidth={8} />
      <motion.circle
        cx={90}
        cy={90}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        strokeLinecap="round"
        transform="rotate(-90 90 90)"
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      <text x={90} y={82} textAnchor="middle" fill="#e8e4d9" fontSize={36} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
        {score}%
      </text>
      <text x={90} y={108} textAnchor="middle" fill="#706b60" fontSize={12} fontFamily="'Lexend', sans-serif">
        Score
      </text>
    </svg>
  );
}

export default function ScoreSlide({ results, topic, learnerName, onNewTopic }: ScoreSlideProps) {
  const [showCertificate, setShowCertificate] = useState(false);

  const passedScenes = results.perScene.filter((s) => s.correct >= 2);
  const needsFocusScenes = results.perScene.filter((s) => s.correct < 2);

  if (showCertificate) {
    return (
      <Certificate
        learnerName={learnerName}
        topic={topic}
        score={results.score}
        onBack={() => setShowCertificate(false)}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#111613',
        color: '#d4d0c8',
        fontFamily: "'Lexend', sans-serif",
        padding: 32,
        gap: 24,
      }}
    >
      {/* Score circle */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <ScoreArc score={results.score} />
      </motion.div>

      {/* Pass/fail badge */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          padding: '8px 20px',
          borderRadius: 20,
          background: results.passed ? '#1a3d1a' : '#3a2d1a',
          border: `1px solid ${results.passed ? '#5cb85c44' : '#f5c84244'}`,
          color: results.passed ? '#5cb85c' : '#f5c842',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {results.passed ? 'Great job! You passed!' : 'Keep learning — you\'ll get there!'}
      </motion.div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: '#706b60', textAlign: 'center' }}>
        {results.correctCount} of {results.totalQuestions} questions correct
      </div>

      {/* Per-scene breakdown */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          maxWidth: 400,
        }}
      >
        {results.perScene.map((scene) => {
          const pct = scene.total > 0 ? Math.round((scene.correct / scene.total) * 100) : 0;
          const barColor = pct >= 67 ? '#5cb85c' : pct >= 34 ? '#f5c842' : '#e07050';
          return (
            <div
              key={scene.scene}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#141a15',
                border: '1px solid #2a2e2a',
              }}
            >
              <div style={{ flex: 1, fontSize: 13, color: '#c8d8c8' }}>
                {scene.sceneTitle}
              </div>
              <div style={{ width: 60, height: 6, borderRadius: 3, background: '#2a3a2a', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.5s' }} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: barColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {scene.correct}/{scene.total}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Strength / Focus areas */}
      {passedScenes.length > 0 && (
        <div style={{ fontSize: 12, color: '#5cb85c', textAlign: 'center' }}>
          Did well: {passedScenes.map((s) => s.sceneTitle).join(', ')}
        </div>
      )}
      {needsFocusScenes.length > 0 && (
        <div style={{ fontSize: 12, color: '#f5c842', textAlign: 'center' }}>
          Needs focus: {needsFocusScenes.map((s) => s.sceneTitle).join(', ')}
        </div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        style={{ display: 'flex', gap: 12, marginTop: 8 }}
      >
        <button
          onClick={onNewTopic}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            background: '#2d5a3d',
            border: 'none',
            color: '#e8e4d9',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          New Topic
        </button>
        {results.passed && (
          <button
            onClick={() => setShowCertificate(true)}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              background: '#3a2d1a',
              border: '1px solid #f5c84244',
              color: '#f5c842',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            View Certificate
          </button>
        )}
      </motion.div>
    </div>
  );
}
