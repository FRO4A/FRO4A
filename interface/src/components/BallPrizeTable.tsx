import type { CategoryBudgetView } from '../types/api';
import { BALL_CATEGORIES } from '../types/game';
import { useI18n } from '../i18n';
import { formatInteger, formatPercent, formatTon } from '../utils/format';
import { cn } from '../utils/cn';

export function BallPrizeTable({ categories, className }: { categories: CategoryBudgetView[]; className?: string }): JSX.Element {
  const { locale, t } = useI18n();
  const rows = [...BALL_CATEGORIES].sort((a, b) => b.category - a.category);
  return (
    <div className={cn('overflow-x-auto no-scrollbar', className)}>
      <table className="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>{t('ball.category')}</th>
            <th>{t('ball.condition')}</th>
            <th className="text-right">{t('common.share')}</th>
            <th className="text-right">{t('common.pool')}</th>
            <th className="text-right">{t('ball.winnersLabel')}</th>
            <th className="text-right">{t('ball.payoutLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((definition) => {
            const budget = categories.find((category) => category.category === definition.category);
            const winners = budget?.winners ?? 0;
            const payout = budget?.isFinal ? budget?.payoutPerTicket : budget?.estimatedPayoutPerTicket;
            return (
              <tr key={definition.category}>
                <td className="primary">
                  <span className="flex items-center gap-1.5">
                    {definition.category}
                    {definition.rollover ? (
                      <span className="subbadge" title={t('ball.rolloverNote')}>
                        ↻
                      </span>
                    ) : null}
                  </span>
                </td>
                <td>{t('ball.conditionLabels')[definition.category - 1] ?? '—'}</td>
                <td className="text-right">{formatPercent(budget?.sharePercent ?? definition.sharePercent)}</td>
                <td className="text-right">{formatTon(budget?.pool)}</td>
                <td className="text-right">{winners > 0 ? formatInteger(winners, locale) : '—'}</td>
                <td className="primary text-right">{payout && BigInt(payout.nanotons) > 0n ? formatTon(payout) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
