import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** True when the last background poll failed but a good snapshot is shown. */
  reconnecting: boolean;
  refresh: () => void;
}

/**
 * Small abortable data loader with optional polling.
 *
 * Stale-while-revalidate: once data is loaded, a transient poll error never
 * clears it. The screen keeps rendering the last good snapshot plus a subtle
 * "Reconnecting…" pill until the next tick succeeds.
 */
export function useApiResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  intervalMs = 30_000,
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const dataRef = useRef<T | null>(null);
  dataRef.current = data;

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    const run = async (): Promise<void> => {
      try {
        const value = await loaderRef.current(controller.signal);
        if (!active) return;
        setData(value);
        setError(null);
        setReconnecting(false);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        if (dataRef.current !== null) setReconnecting(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    const timer = intervalMs > 0 ? window.setInterval(() => void run(), intervalMs) : null;
    return () => {
      active = false;
      controller.abort();
      if (timer !== null) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, intervalMs, ...deps]);

  return { data, error, loading, reconnecting, refresh };
}
