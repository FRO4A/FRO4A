import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Telegram Mini App integration that is completely optional: outside Telegram
 * `window.Telegram.WebApp` is absent and this effect does nothing.
 */
export function useTelegramShell(): void {
  const { theme } = useTheme();
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const telegram = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            ready?: () => void;
            expand?: () => void;
            setHeaderColor?: (value: string) => void;
            setBackgroundColor?: (value: string) => void;
          };
        };
      }
    ).Telegram;
    if (!telegram?.WebApp) return undefined;
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor(theme === 'dark' ? '#0B0D11' : '#EEF1F5');
      WebApp.setBackgroundColor(theme === 'dark' ? '#0B0D11' : '#EEF1F5');
    } catch {
      // never let Telegram SDK availability break the web app
    }
    return undefined;
  }, [theme]);
}

