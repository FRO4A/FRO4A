import type { CategoryBudgetView } from '../types/api';
import { PLACES } from '../types/game';
import { useI18n } from '../i18n';
import { formatInteger, formatPercent, formatTon } from '../utils/format';
import { cn } from '../utils/cn';

export function HundredKPlaceTable({ places, className }: { places: CategoryBudgetView[]; className?: string }): JSX.Element {
  const { locale, t } = useI18n();
  return (
    <div className={cn('overflow-x-auto no-scrollbar', className)}>
      <table className="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>{t('hundredK.place')}</th>
            <th className="text-right">{t('hundredK.winnersLabel')}</th>
            <th className="text-right">{t('hundredK.shareLabel')}</th>
            <th className="text-right">{t('hundredK.poolLabel')}</th>
            <th className="text-right">{t('hundredK.perWinner')}</th>
          </tr>
        </thead>
        <tbody>
          {PLACES.map((definition) => {
            const budget = places.find((place) => place.category === definition.place);
            const winners = budget?.winners ?? definition.winnersCount;
            const sharePercent = budget?.sharePercent ?? definition.sharePercent;
            const payout = budget?.isFinal ? budget?.payoutPerTicket : budget?.estimatedPayoutPerTicket;
            const perTicketShare = definition.winnersCount > 0 ? sharePercent / definition.winnersCount : 0;
            return (
              <tr key={definition.place}>
                <td className="primary">#{definition.place}</td>
                <td className="text-right">{formatInteger(winners, locale)}</td>
                <td className="text-right">{formatPercent(sharePercent)}</td>
                <td className="text-right">{formatTon(budget?.poolTotal)}</td>
                <td className="primary text-right">
                  {payout && BigInt(payout.nanotons) > 0n ? formatTon(payout) : '—'}
                  <span className="block text-[10px] font-normal text-[var(--text-muted)]">
                    {perTicketShare < 1
                      ? `${(Math.floor(perTicketShare * 1000) / 1000).toFixed(3)}%`
                      : formatPercent(perTicketShare)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
