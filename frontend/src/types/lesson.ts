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

export interface DrawEllipse {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
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
  | DrawEllipse
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
  quizzes?: SceneQuiz[];
}

export interface LessonParams {
  topic: string;
  name: string;
  ageGroup: string;
  difficulty: string;
  recaptchaToken: string;
}

/* ── Quiz types ────────────────────────────────────── */

export interface QuizOption {
  label: string;
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  correct: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
}

export interface SceneQuiz {
  scene: number;
  scene_title: string;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  scene: number;
  questionIndex: number;
  selected: string | null;
  correct: string;
  isCorrect: boolean;
}

export interface QuizResults {
  totalQuestions: number;
  correctCount: number;
  score: number; // 0-100
  passed: boolean; // score >= 70
  perScene: {
    scene: number;
    sceneTitle: string;
    correct: number;
    total: number;
  }[];
  answers: QuizAnswer[];
}
