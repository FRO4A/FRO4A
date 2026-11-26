import { useEffect, useState } from 'react';
import { computeRemaining, type RemainingTime } from '../utils/time';

/** Live countdown driven by the public on-chain timestamp (no server trust needed). */
export function useCountdown(target: string | number | Date | null | undefined): RemainingTime {
  const [remaining, setRemaining] = useState<RemainingTime>(() => computeRemaining(target));

  useEffect(() => {
    setRemaining(computeRemaining(target));
    if (target === null || target === undefined) return undefined;
    const timer = window.setInterval(() => setRemaining(computeRemaining(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return remaining;
}
