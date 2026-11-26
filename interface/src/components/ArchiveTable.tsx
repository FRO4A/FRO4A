import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { HistoryDrawView } from '../types/api';
import type { GameType } from '../types/game';
import { DRAW_STATUS } from '../types/game';
import { useI18n } from '../i18n';
import { formatInteger, formatTon, formatDateTime } from '../utils/format';
import { BallSet } from './ui/Ball';
import { DrawStatusBadge } from './ui/StatusBadge';
import { tonviewerAddressUrl } from '../config/deployments';
import { safeExternalUrl } from '../utils/externalUrl';
import { cn } from '../utils/cn';

export function ArchiveTable({
  gameType,
  items,
  onVerify,
  className,
}: {
  gameType: GameType;
  items: HistoryDrawView[];
  onVerify?: (roundId: number) => void;
  className?: string;
}): JSX.Element {
  const { locale, t } = useI18n();
  // The server already returns every closed round (status 2..5); never slice or
  // hide a round here — a 0-winner round is still a real, verifiable result.
  const finished = items.filter((item) => item.status >= DRAW_STATUS.SALES_CLOSED);

  if (finished.length === 0) {
    return (
      <div className="glass-nested px-4 py-8 text-center text-sm text-secondary">
        {gameType === 'BALL' ? t('ball.archiveEmpty') : t('hundredK.archiveEmpty')}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto no-scrollbar', className)}>
      <table className="data-table min-w-[640px]">
        <thead>
          <tr>
            <th>{t('common.round')}</th>
            <th>{t('common.status')}</th>
            <th className="text-right">{t('common.ticketsSold')}</th>
            <th className="text-right">{t('common.prizePool')}</th>
            <th>{gameType === 'BALL' ? t('ball.winnerOfDraw') : t('hundredK.winnersDrawn')}</th>
            <th className="text-right">{t('common.deadline')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {finished.map((item) => (
            <tr key={`${item.roundId}-${item.drawAddress}`}>
              <td className="primary">#{item.roundId}</td>
              <td>
                <DrawStatusBadge status={item.status} />
                <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {formatInteger(item.winnerCount, locale)} {t('common.winners')}
                </div>
              </td>
              <td className="text-right">{formatInteger(item.totalTicketsSold, locale)}</td>
              <td className="text-right">
                {formatTon(item.totalBudget)}
                {item.rolloverOut ? (
                  <div className="text-[10px] text-[var(--text-muted)]">
                    ↻ {formatTon(item.rolloverOut)}
                  </div>
                ) : null}
              </td>
              <td>
                {gameType === 'BALL' && item.winningNumbers ? (
                  <BallSet whites={item.winningNumbers.whites} red={item.winningNumbers.red} size="sm" />
                ) : item.winningTickets ? (
                  <span className="tabular text-xs">
                    {item.winningTickets.tickets
                      .slice(0, 5)
                      .map((number) => `#${number.toString().padStart(6, '0')}`)
                      .join(' · ')}
                    {item.winningTickets.tickets.length > 5 ? ' …' : ''}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="text-right text-xs">
                {formatDateTime(item.deadlineTimestamp ?? item.targetVrfTime ?? item.firstTicketTimestamp, locale)}
              </td>
              <td>
                <div className="flex items-center justify-end gap-1.5">
                  {onVerify && (item.winningNumbers || item.winningTickets) ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onVerify?.(item.roundId)}
                    >
                      <ShieldCheck size={14} strokeWidth={1.75} />
                      {t('nav.verify')}
                    </button>
                  ) : null}
                  <a
                    href={safeExternalUrl(item.tonviewerUrl, tonviewerAddressUrl(item.drawAddress))}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="icon-btn h-8 w-8"
                    aria-label={t('common.viewExplorer')}
                  >
                    <ExternalLink size={14} strokeWidth={1.75} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
