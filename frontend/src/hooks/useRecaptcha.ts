import { useEffect, useCallback } from 'react';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export function useRecaptcha() {
  useEffect(() => {
    if (!SITE_KEY) return;

    // Don't load twice
    if (document.querySelector(`script[src*="recaptcha"]`)) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string> => {
    if (!SITE_KEY) return '';

    return new Promise((resolve) => {
      const g = window.grecaptcha;
      if (!g) {
        resolve('');
        return;
      }
      g.ready(() => {
        g.execute(SITE_KEY, { action }).then(resolve).catch(() => resolve(''));
      });
    });
  }, []);

  return { executeRecaptcha };
}
