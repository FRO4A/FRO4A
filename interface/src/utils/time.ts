export interface RemainingTime {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function computeRemaining(target: string | number | Date | null | undefined, nowMs = Date.now()): RemainingTime {
  if (target === null || target === undefined) {
    return { totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const targetMs =
    target instanceof Date ? target.getTime() : typeof target === 'number' ? target : new Date(target).getTime();
  if (!Number.isFinite(targetMs)) {
    return { totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return {
    totalSeconds,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    expired: totalSeconds <= 0,
  };
}

export function formatRemaining(remaining: RemainingTime, units: { d: string; h: string; m: string; s: string }): string {
  if (remaining.expired) return `0${units.s}`;
  if (remaining.days > 0) {
    return `${remaining.days}${units.d} ${remaining.hours.toString().padStart(2, '0')}${units.h}`;
  }
  if (remaining.hours > 0) {
    return `${remaining.hours}${units.h} ${remaining.minutes.toString().padStart(2, '0')}${units.m}`;
  }
  return `${remaining.minutes}${units.m} ${remaining.seconds.toString().padStart(2, '0')}${units.s}`;
}
