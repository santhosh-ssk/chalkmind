declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export function initGA() {
  if (!GA_ID) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

export function trackPageView(path: string) {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', name, params);
}
