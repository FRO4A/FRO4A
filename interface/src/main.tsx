import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeRuntimeConfig } from './lib/runtimeConfig';
import { initTelegramWebApp } from './lib/telegram';
import './styles/index.css';

/**
 * Register the instant-open cache only for production builds. The worker never
 * caches `/api/*`, `/health` or `runtime-config.json`, so live blockchain data
 * always comes from the currently active tunnel.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    try {
      const swUrl = new URL('sw.js', document.baseURI).toString();
      void navigator.serviceWorker.register(swUrl).catch(() => undefined);
    } catch {
      // Service workers are an enhancement; the app must still boot without one.
    }
  });
}

async function bootstrap(): Promise<void> {
  // Telegram shell first: viewport variables must exist before the first paint.
  initTelegramWebApp();
  // Resolve `?api=` / sessionStorage / runtime-config.json before any API call.
  await initializeRuntimeConfig();
  registerServiceWorker();

  const container = document.getElementById('root');
  if (!container) throw new Error('Root container not found');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
