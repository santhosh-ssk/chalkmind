import { useRef, useState, useEffect } from 'react';
import type {
  DrawPath,
  DrawLine,
  DrawArrow,
  DrawCircle,
  DrawEllipse,
  DrawRect,
  DrawText,
  DrawAnnotation,
  DrawBrace,
  DrawCommand,
} from '../../types/lesson';

/* ── AnimPath ─────────────────────────────────────────── */

function AnimPath({ d, stroke, fill, strokeWidth, progress }: DrawPath & { progress: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(1000);

  useEffect(() => {
    if (ref.current) {
      try {
        const l = ref.current.getTotalLength();
        if (l > 0) setLen(l);
      } catch {
        /* ignore */
      }
    }
  }, [d]);

  if (!d || progress <= 0) return null;
  const p = Math.min(progress, 1);
  const offset = len * (1 - p);
  const fillOp = fill && fill !== 'none' ? Math.max(0, (p - 0.5) / 0.5) : 0;

  return (
    <path
      ref={ref}
      d={d}
      stroke={stroke || '#e8e4d9'}
      strokeWidth={strokeWidth || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={fill && fill !== 'none' ? fill : 'none'}
      fillOpacity={fillOp}
      strokeDasharray={len}
      strokeDashoffset={offset}
      style={{ filter: `drop-shadow(0 0 1px ${stroke || '#e8e4d9'}22)` }}
    />
  );
}

/* ── AnimLine ─────────────────────────────────────────── */

function AnimLine({ x1, y1, x2, y2, stroke, strokeWidth, dash, progress }: DrawLine & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const ex = x1 + (x2 - x1) * p;
  const ey = y1 + (y2 - y1) * p;
  return (
    <line
      x1={x1}
      y1={y1}
      x2={ex}
      y2={ey}
      stroke={stroke || '#e8e4d9'}
      strokeWidth={strokeWidth || 2}
      strokeLinecap="round"
      strokeDasharray={dash ? '6 4' : 'none'}
      opacity={Math.min(p * 3, 1)}
    />
  );
}

/* ── AnimArrow ────────────────────────────────────────── */

function AnimArrow({ x1, y1, x2, y2, stroke, strokeWidth, dash, progress }: DrawArrow & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const ex = x1 + (x2 - x1) * p;
  const ey = y1 + (y2 - y1) * p;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hs = 9;
  const c = stroke || '#e8e4d9';
  const w = strokeWidth || 2;
  return (
    <g opacity={Math.min(p * 3, 1)}>
      <line
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={dash ? '6 4' : 'none'}
      />
      {p > 0.85 && (
        <>
          <line
            x1={ex}
            y1={ey}
            x2={ex - hs * Math.cos(angle - 0.4)}
            y2={ey - hs * Math.sin(angle - 0.4)}
            stroke={c}
            strokeWidth={w}
            strokeLinecap="round"
          />
          <line
            x1={ex}
            y1={ey}
            x2={ex - hs * Math.cos(angle + 0.4)}
            y2={ey - hs * Math.sin(angle + 0.4)}
            stroke={c}
            strokeWidth={w}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

/* ── AnimCircle ───────────────────────────────────────── */

function AnimCircle({ cx, cy, r, stroke, fill, strokeWidth, progress }: DrawCircle & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const circumference = 2 * Math.PI * r;
  const fillOp = fill && fill !== 'none' ? Math.max(0, (p - 0.5) / 0.5) : 0;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={stroke || '#e8e4d9'}
      strokeWidth={strokeWidth || 2}
      fill={fill && fill !== 'none' ? fill : 'none'}
      fillOpacity={fillOp}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - p)}
    />
  );
}

/* ── AnimEllipse ─────────────────────────────────────── */

function AnimEllipse({ cx, cy, rx, ry, stroke, fill, strokeWidth, progress }: DrawEllipse & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  // Approximate circumference of ellipse (Ramanujan)
  const h = ((rx - ry) ** 2) / ((rx + ry) ** 2);
  const circumference = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const fillOp = fill && fill !== 'none' ? Math.max(0, (p - 0.5) / 0.5) : 0;
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      stroke={stroke || '#e8e4d9'}
      strokeWidth={strokeWidth || 2}
      fill={fill && fill !== 'none' ? fill : 'none'}
      fillOpacity={fillOp}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - p)}
    />
  );
}

/* ── AnimRect ─────────────────────────────────────────── */

function AnimRect({ x, y, w, h, stroke, fill, strokeWidth, rx, progress }: DrawRect & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const perim = 2 * (w + h);
  const fillOp = fill && fill !== 'none' ? Math.max(0, (p - 0.5) / 0.5) : 0;
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx || 0}
      stroke={stroke || '#e8e4d9'}
      strokeWidth={strokeWidth || 1}
      fill={fill && fill !== 'none' ? fill : 'none'}
      fillOpacity={fillOp}
      strokeLinecap="round"
      strokeDasharray={perim}
      strokeDashoffset={perim * (1 - p)}
    />
  );
}

/* ── AnimText ─────────────────────────────────────────── */

function AnimText({ x, y, content, color, fontSize, progress }: DrawText & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const chars = Math.ceil((content || '').length * p);
  return (
    <text
      x={x}
      y={y}
      fill={color || '#e8e4d9'}
      fontSize={Math.max(fontSize || 18, 18)}
      fontFamily="'Caveat', 'Segoe Print', cursive"
      fontWeight={600}
      textAnchor="middle"
      opacity={Math.min(p * 3, 1)}
      style={{ filter: `drop-shadow(0 0 2px ${color || '#e8e4d9'}22)` }}
    >
      {(content || '').slice(0, chars)}
    </text>
  );
}

/* ── AnimAnnotation ───────────────────────────────────── */

function AnimAnnotation({ x, y, content, color, fontSize, progress }: DrawAnnotation & { progress: number }) {
  if (progress <= 0.1) return null;
  const p = Math.min(progress, 1);
  const c = color || '#e8e4d9';
  const fs = Math.max(fontSize || 16, 16);
  const textLen = (content || '').length * fs * 0.45;
  const pad = 8;
  const bw = textLen + pad * 2;
  const bh = fs + pad * 2;
  return (
    <g opacity={Math.min((p - 0.1) * 3, 1)}>
      <rect
        x={x - bw / 2}
        y={y - bh / 2}
        width={bw}
        height={bh}
        rx={4}
        fill="#1a201a"
        fillOpacity={0.85}
        stroke={c}
        strokeWidth={1}
        strokeOpacity={0.3}
      />
      <text
        x={x}
        y={y + fs * 0.35}
        fill={c}
        fontSize={fs}
        fontFamily="'Caveat', cursive"
        fontWeight={500}
        textAnchor="middle"
      >
        {content}
      </text>
    </g>
  );
}

/* ── AnimBrace ────────────────────────────────────────── */

function AnimBrace({ x, y, height, side, label, color, progress }: DrawBrace & { progress: number }) {
  if (progress <= 0) return null;
  const p = Math.min(progress, 1);
  const c = color || '#e8e4d9';
  const dir = side === 'left' ? -1 : 1;
  const mid = y + height / 2;
  const d = `M${x} ${y} C${x + 12 * dir} ${y}, ${x + 12 * dir} ${mid - 8}, ${x + 18 * dir} ${mid} C${x + 12 * dir} ${mid + 8}, ${x + 12 * dir} ${y + height}, ${x} ${y + height}`;
  return (
    <g opacity={Math.min(p * 2, 1)}>
      <AnimPath d={d} stroke={c} fill="none" strokeWidth={1.5} progress={p} type="path" />
      {p > 0.6 && label && (
        <text
          x={x + 24 * dir}
          y={mid + 5}
          fill={c}
          fontSize={13}
          fontFamily="'Caveat', cursive"
          textAnchor={side === 'left' ? 'end' : 'start'}
          opacity={Math.min((p - 0.6) * 4, 1)}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ── Dispatcher ───────────────────────────────────────── */

export function RenderDrawCommand({ cmd, progress }: { cmd: DrawCommand; progress: number }) {
  if (!cmd || !cmd.type) return null;
  switch (cmd.type) {
    case 'path':
      return <AnimPath {...cmd} progress={progress} />;
    case 'line':
      return <AnimLine {...cmd} progress={progress} />;
    case 'arrow':
      return <AnimArrow {...cmd} progress={progress} />;
    case 'circle':
      return <AnimCircle {...cmd} progress={progress} />;
    case 'ellipse':
      return <AnimEllipse {...cmd} progress={progress} />;
    case 'rect':
      return <AnimRect {...cmd} progress={progress} />;
    case 'text':
      return <AnimText {...cmd} progress={progress} />;
    case 'annotation':
      return <AnimAnnotation {...cmd} progress={progress} />;
    case 'brace':
      return <AnimBrace {...cmd} progress={progress} />;
    default:
      return null;
  }
}
