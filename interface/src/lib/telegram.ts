import WebApp from '@twa-dev/sdk';

/**
 * Telegram Mini App bootstrap, guarded for regular browsers.
 *
 * `@twa-dev/sdk` installs a safe `window.Telegram.WebApp` shim outside Telegram,
 * but we still check the real bridge before calling any method so a plain
 * browser / GitHub Pages visit is completely unaffected.
 *
 * The viewport + safe-area values are mirrored into CSS variables consumed by
 * the floating glass dock (`--tg-safe-bottom`) and the app shell
 * (`--tg-viewport-height` / `--tg-viewport-stable-height`).
 */
interface TelegramWebAppLike {
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: { top?: number; bottom?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number };
  onEvent?: (event: string, handler: () => void) => void;
}

interface TelegramWindow {
  Telegram?: { WebApp?: TelegramWebAppLike };
}

export function getTelegramWebApp(): TelegramWebAppLike | null {
  if (typeof window === 'undefined') return null;
  const telegram = (window as unknown as TelegramWindow).Telegram;
  return telegram?.WebApp ?? null;
}

function applyTelegramViewport(app: TelegramWebAppLike): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const viewportHeight = Number(app.viewportHeight);
  const stableHeight = Number(app.viewportStableHeight);
  if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
    root.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
  }
  if (Number.isFinite(stableHeight) && stableHeight > 0) {
    root.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
  }
  // Device notch/status-bar inset + Telegram's own top UI inset. The header
  // cluster uses `max(0.5rem, env(safe-area-inset-top), var(--tg-safe-top))` so
  // it stays clear of Telegram's native fullscreen pills.
  const safeTop = Number(app.safeAreaInset?.top);
  const contentTop = Number(app.contentSafeAreaInset?.top);
  const top = Math.max(0, Number.isFinite(safeTop) ? safeTop : 0) +
    Math.max(0, Number.isFinite(contentTop) ? contentTop : 0);
  root.style.setProperty('--tg-safe-top', `${top}px`);
  // Device home-indicator inset + Telegram's own bottom UI inset.
  const safeBottom = Number(app.safeAreaInset?.bottom);
  const contentBottom = Number(app.contentSafeAreaInset?.bottom);
  const bottom = Math.max(0, Number.isFinite(safeBottom) ? safeBottom : 0) +
    Math.max(0, Number.isFinite(contentBottom) ? contentBottom : 0);
  root.style.setProperty('--tg-safe-bottom', `${bottom}px`);
}

export function initTelegramWebApp(): void {
  const app = getTelegramWebApp();
  if (app === null) return;
  try {
    WebApp.ready();
    WebApp.expand();
    // Prevent Telegram from collapsing the Mini App while the user scrolls.
    if (typeof WebApp.disableVerticalSwipes === 'function') WebApp.disableVerticalSwipes();
  } catch {
    // Never let Telegram SDK availability break the web app.
  }
  applyTelegramViewport(app);
  if (typeof app.onEvent === 'function') {
    for (const event of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'] as const) {
      try {
        app.onEvent(event, () => applyTelegramViewport(app));
      } catch {
        // Older Telegram clients may not expose every event.
      }
    }
  }
}
