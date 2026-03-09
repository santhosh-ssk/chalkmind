/* Drawing DSL types — matches the JSON schema from Gemini */

export interface DrawPath {
  type: 'path';
  d: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export interface DrawLine {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
  dash?: boolean;
}

export interface DrawArrow {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
  dash?: boolean;
}

export interface DrawCircle {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export interface DrawRect {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  rx?: number;
}

export interface DrawText {
  type: 'text';
  x: number;
  y: number;
  content: string;
  color?: string;
  fontSize?: number;
}

export interface DrawAnnotation {
  type: 'annotation';
  x: number;
  y: number;
  content: string;
  color?: string;
  fontSize?: number;
}

export interface DrawBrace {
  type: 'brace';
  x: number;
  y: number;
  height: number;
  side: 'left' | 'right';
  label?: string;
  color?: string;
}

export type DrawCommand =
  | DrawPath
  | DrawLine
  | DrawArrow
  | DrawCircle
  | DrawRect
  | DrawText
  | DrawAnnotation
  | DrawBrace;

export interface LessonStep {
  narration: string;
  draws: DrawCommand[];
  scene: number;
  scene_title: string;
}

export interface Lesson {
  title: string;
  steps: LessonStep[];
  scene_count: number;
}
