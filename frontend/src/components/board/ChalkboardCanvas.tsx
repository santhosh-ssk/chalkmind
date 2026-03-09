import type { Lesson } from '../../types/lesson';
import { RenderDrawCommand } from './DrawCommand';

interface ChalkboardCanvasProps {
  lesson: Lesson;
  currentStep: number;
  stepProgress: number;
}

export default function ChalkboardCanvas({ lesson, currentStep, stepProgress }: ChalkboardCanvasProps) {
  // Determine which scene the current step belongs to
  const currentScene = currentStep >= 0 && currentStep < lesson.steps.length
    ? lesson.steps[currentStep].scene
    : -1;

  // Compute visible draws — only from steps in the CURRENT scene
  const allDraws: { cmd: (typeof lesson.steps)[0]['draws'][0]; progress: number; key: string }[] = [];

  for (let s = 0; s <= Math.min(currentStep, lesson.steps.length - 1); s++) {
    const step = lesson.steps[s];
    if (!step?.draws) continue;
    // Only render draws from the same scene as the current step
    if (step.scene !== currentScene) continue;

    const count = step.draws.length;
    step.draws.forEach((cmd, i) => {
      const isCurrentStep = s === currentStep;
      let progress = 1;
      if (isCurrentStep) {
        const cmdStart = i / count;
        const cmdEnd = (i + 1) / count;
        progress = Math.max(0, Math.min(1, (stepProgress - cmdStart) / (cmdEnd - cmdStart)));
      }
      allDraws.push({ cmd, progress, key: `${s}-${i}` });
    });
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        background: '#111613',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 8px 50px #00000070',
          border: '4px solid #3a3228',
          position: 'relative',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {/* Wooden frame outer border */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            border: '4px solid #5a4a35',
            borderRadius: 12,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        <svg
          viewBox="0 0 780 680"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', background: '#1a201a', width: '100%', height: '100%' }}
        >
          {/* Subtle grid */}
          {Array.from({ length: 20 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={i * 40}
              y1={0}
              x2={i * 40}
              y2={680}
              stroke="#ffffff"
              strokeWidth={0.3}
              opacity={0.025}
            />
          ))}
          {Array.from({ length: 17 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={i * 40}
              x2={780}
              y2={i * 40}
              stroke="#ffffff"
              strokeWidth={0.3}
              opacity={0.025}
            />
          ))}

          {/* Draw commands */}
          {allDraws.map(({ cmd, progress, key }) => (
            <RenderDrawCommand key={key} cmd={cmd} progress={progress} />
          ))}

          {/* Empty state */}
          {currentStep < 0 && (
            <text
              x={390}
              y={340}
              textAnchor="middle"
              fill="#2a3a2a"
              fontSize={18}
              fontFamily="'Caveat', cursive"
              fontWeight={500}
            >
              Press Play to begin...
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
