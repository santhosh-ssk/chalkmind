import { useState, useEffect } from 'react';
import type { Lesson } from '../types/lesson';

type LessonState =
  | { status: 'loading' }
  | { status: 'success'; lesson: Lesson }
  | { status: 'error'; message: string };

export function useLesson(topic: string): LessonState & { retry: () => void } {
  const [state, setState] = useState<LessonState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    fetch('/api/generate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(
            (body) => {
              throw new Error(body.detail || `Server error (${res.status})`);
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
  }, [topic, retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  return { ...state, retry };
}
