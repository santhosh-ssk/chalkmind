import { useState, useEffect } from 'react';
import type { Lesson, LessonParams } from '../types/lesson';

type LessonState =
  | { status: 'loading' }
  | { status: 'success'; lesson: Lesson }
  | { status: 'error'; message: string };

export function useLesson(params: LessonParams): LessonState & { retry: () => void } {
  const [state, setState] = useState<LessonState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    fetch('/api/generate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: params.topic,
        name: params.name,
        age_group: params.ageGroup,
        difficulty: params.difficulty,
        recaptcha_token: params.recaptchaToken,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(
            (body) => {
              const detail = body.detail;
              let message: string;
              if (typeof detail === 'string') {
                message = detail;
              } else if (Array.isArray(detail)) {
                message = detail.map((e: { msg?: string }) => e.msg || '').join(', ');
              } else {
                message = `Server error (${res.status})`;
              }
              throw new Error(message);
            },
            () => {
              throw new Error(`Server error (${res.status})`);
            },
          );
        }
        return res.json();
      })
      .then((lesson: Lesson) => {
        setState({ status: 'success', lesson });
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', message: err.message });
      });

    return () => controller.abort();
  }, [params.topic, params.name, params.ageGroup, params.difficulty, params.recaptchaToken, retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  return { ...state, retry };
}
