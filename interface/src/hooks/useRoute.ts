import { useCallback, useEffect, useState } from 'react';
import type { AppRoute } from '../types/game';

const ROUTES: readonly AppRoute[] = ['overview', 'games', 'ball', '100k', 'tickets', 'verify'];

function parseHash(): AppRoute {
  if (typeof window === 'undefined') return 'overview';
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  return (ROUTES as readonly string[]).includes(raw) ? (raw as AppRoute) : 'overview';
}

/**
 * Pure client-side hash routing. Changing the hash never reloads the page, so
 * <TonConnectUIProvider> stays mounted and the wallet session is preserved.
 */
export function useHashRoute(): { route: AppRoute; navigate: (route: AppRoute) => void } {
  const [route, setRoute] = useState<AppRoute>(parseHash);

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    if (typeof window === 'undefined') return;
    const target = next === 'overview' ? '#/' : `#/${next}`;
    if (window.location.hash === target) {
      setRoute(next);
      return;
    }
    window.location.hash = target;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { route, navigate };
}
