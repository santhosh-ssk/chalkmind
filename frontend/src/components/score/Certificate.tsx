/**
 * SVG-based certificate of completion — downloadable as PNG.
 */
import { useRef, useCallback } from 'react';

interface CertificateProps {
  learnerName: string;
  topic: string;
  score: number;
  onBack: () => void;
}

function CertificateSVG({ learnerName, topic, score }: Omit<CertificateProps, 'onBack'>) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <svg
      width={800}
      height={560}
      viewBox="0 0 800 560"
      xmlns="http://www.w3.org/2000/svg"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {/* Background */}
      <rect width={800} height={560} fill="#1a201a" rx={16} />

      {/* Gold border */}
      <rect x={16} y={16} width={768} height={528} fill="none" stroke="#f5c842" strokeWidth={3} rx={12} />
      <rect x={24} y={24} width={752} height={512} fill="none" stroke="#f5c84244" strokeWidth={1} rx={10} />

      {/* Corner decorations */}
      {[
        [40, 40, 0],
        [760, 40, 90],
        [760, 520, 180],
        [40, 520, 270],
      ].map(([cx, cy, rot], i) => (
        <g key={i} transform={`translate(${cx},${cy}) rotate(${rot})`}>
          <line x1={0} y1={0} x2={30} y2={0} stroke="#f5c842" strokeWidth={2} />
          <line x1={0} y1={0} x2={0} y2={30} stroke="#f5c842" strokeWidth={2} />
        </g>
      ))}

      {/* Title */}
      <text x={400} y={85} textAnchor="middle" fill="#f5c842" fontSize={14} fontFamily="'Lexend', sans-serif" letterSpacing={6}>
        CERTIFICATE OF COMPLETION
      </text>

      {/* Decorative line */}
      <line x1={200} y1={105} x2={600} y2={105} stroke="#f5c84244" strokeWidth={1} />

      {/* Presented to */}
      <text x={400} y={155} textAnchor="middle" fill="#706b60" fontSize={13} fontFamily="'Lexend', sans-serif">
        This is to certify that
      </text>

      {/* Learner name */}
      <text x={400} y={205} textAnchor="middle" fill="#e8e4d9" fontSize={36} fontFamily="'Caveat', cursive" fontWeight={700}>
        {learnerName}
      </text>

      {/* Underline */}
      <line x1={220} y1={218} x2={580} y2={218} stroke="#2a3a2a" strokeWidth={1} />

      {/* Has completed */}
      <text x={400} y={260} textAnchor="middle" fill="#706b60" fontSize={13} fontFamily="'Lexend', sans-serif">
        has successfully completed the lesson on
      </text>

      {/* Topic */}
      <text x={400} y={305} textAnchor="middle" fill="#5cb85c" fontSize={24} fontFamily="'Caveat', cursive" fontWeight={600}>
        {topic.length > 50 ? topic.slice(0, 50) + '...' : topic}
      </text>

      {/* Score */}
      <text x={400} y={365} textAnchor="middle" fill="#f5c842" fontSize={18} fontFamily="'JetBrains Mono', monospace" fontWeight={700}>
        Score: {score}%
      </text>

      {/* Date */}
      <text x={400} y={420} textAnchor="middle" fill="#706b60" fontSize={12} fontFamily="'Lexend', sans-serif">
        {date}
      </text>

      {/* Branding */}
      <line x1={300} y1={460} x2={500} y2={460} stroke="#2a3a2a" strokeWidth={1} />
      <text x={400} y={490} textAnchor="middle" fill="#4a5a4a" fontSize={16} fontFamily="'Caveat', cursive" fontWeight={600}>
        ChalkMind
      </text>
      <text x={400} y={510} textAnchor="middle" fill="#3a3e3a" fontSize={10} fontFamily="'Lexend', sans-serif">
        AI Whiteboard Tutor
      </text>
    </svg>
  );
}

export default function Certificate({ learnerName, topic, score, onBack }: CertificateProps) {
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const downloadPNG = useCallback(async () => {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1600, 1120);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;

        // Try Web Share API first
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'certificate.png', { type: 'image/png' })] })) {
          navigator.share({
            title: 'ChalkMind Certificate',
            text: `I scored ${score}% on "${topic}" with ChalkMind!`,
            files: [new File([blob], 'chalkmind-certificate.png', { type: 'image/png' })],
          }).catch(() => {
            // Fallback to download
            triggerDownload(blob);
          });
        } else {
          triggerDownload(blob);
        }
      }, 'image/png');
    };
    img.src = url;
  }, [score, topic]);

  const triggerDownload = (blob: Blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chalkmind-certificate.png';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#111613',
        padding: 32,
        gap: 24,
      }}
    >
      <div ref={svgContainerRef}>
        <CertificateSVG learnerName={learnerName} topic={topic} score={score} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid #2a3a2a',
            color: '#706b60',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: "'Lexend', sans-serif",
          }}
        >
          Back
        </button>
        <button
          onClick={downloadPNG}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: '#2d5a3d',
            border: 'none',
            color: '#e8e4d9',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Lexend', sans-serif",
          }}
        >
          Download Certificate
        </button>
      </div>
    </div>
  );
}
