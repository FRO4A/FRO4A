import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { PillTone } from '../../utils/status';
import {
  ticketStatusKey,
  ticketStatusTone,
  ticketResultKey,
  ticketResultTone,
  drawStatusKey,
  drawStatusTone,
} from '../../utils/status';
import type { TicketResult } from '../../types/game';
import { cn } from '../../utils/cn';

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'pill-neutral',
  accent: 'pill-accent',
  success: 'pill-success',
  warning: 'pill-warning',
  danger: 'pill-danger',
};

export function DrawStatusBadge({ status, className }: { status: number; className?: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className={cn('pill', TONE_CLASS[drawStatusTone(status)], className)}>
      {t(`status.${drawStatusKey(status)}`)}
    </span>
  );
}

export function TicketStatusBadge({ status, className }: { status: number; className?: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className={cn('pill', TONE_CLASS[ticketStatusTone(status)], className)}>
      {t(`status.${ticketStatusKey(status)}`)}
    </span>
  );
}

/**
 * Draw-aware ticket badge: never shows a finished round as "Active".
 * TALLYING -> "Tallying Winners", CLAIM_OPEN non-winner -> "Not a Winner", etc.
 */
export function TicketResultBadge({ result, className }: { result: TicketResult; className?: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className={cn('pill', TONE_CLASS[ticketResultTone(result)], className)}>
      {t(`status.${ticketResultKey(result)}`)}
    </span>
  );
}

export function TonePill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}): JSX.Element {
  return <span className={cn('pill', TONE_CLASS[tone], className)}>{children}</span>;
}
