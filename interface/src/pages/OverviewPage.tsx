import type { ReactNode } from 'react';
import { ArrowRight, CircleDot, Lock, ShieldCheck, Trophy } from 'lucide-react';
import type { AppRoute } from '../types/game';
import type { OverviewGame } from '../types/api';
import { useI18n } from '../i18n';
import { fetchOverview } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatInteger, formatTon } from '../utils/format';
import { Countdown } from '../components/ui/Countdown';
import { DrawStatusBadge } from '../components/ui/StatusBadge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ErrorState, LoadingState } from '../components/ui/States';
import { ConnectionPill } from '../components/ui/ConnectionPill';
import { RulesSection } from '../components/RulesSection';
import { WaitingForRoundCard } from '../components/WaitingForRoundCard';
import { isPendingRound } from '../utils/roundState';
import { cn } from '../utils/cn';

export function OverviewPage({ navigate }: { navigate: (route: AppRoute) => void }): JSX.Element {
  const { t, locale } = useI18n();
  const overview = useApiResource((signal) => fetchOverview(signal), [], 30_000);

  return (
    <div className="space-y-6 pb-2">
      <ConnectionPill visible={overview.reconnecting} />

      {/* `#/verify` opens the My Tickets tab with the Verify sub-view active —
          Verify is no longer a standalone dock tab. */}
      <section className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => navigate('games')}>
          {t('common.allGames')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('verify')}>
          <ShieldCheck size={16} strokeWidth={1.75} />
          {t('overview.verifyCta')}
        </button>
      </section>

      {overview.loading && overview.data === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          <LoadingState />
          <LoadingState />
        </div>
      ) : null}

      {overview.error !== null && overview.data === null ? (
        <ErrorState body={t('errors.api')} onRetry={overview.refresh} />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {t('overview.gamesSectionTitle')}
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-secondary">{t('overview.gamesSectionSubtitle')}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('games')}>
            {t('overview.allGamesCta')}
            <ArrowRight size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(overview.data?.games ?? []).map((game) => (
            <GameSummaryCard key={game.gameType} game={game} locale={locale} navigate={navigate} />
          ))}
        </div>
        {overview.data !== null && overview.data.games.length === 0 ? (
          <WaitingForRoundCard onRefresh={overview.refresh} />
        ) : null}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="glass p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="glass-icon h-8 w-8 rounded-xl">
              <Lock size={16} strokeWidth={1.75} />
            </span>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('overview.protocolTitle')}</h2>
          </div>
          <p className="text-sm leading-6 text-secondary">{t('overview.protocolBody')}</p>
        </section>
        <section className="glass p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="glass-icon h-8 w-8 rounded-xl">
              <ShieldCheck size={16} strokeWidth={1.75} />
            </span>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('overview.transparencyTitle')}</h2>
          </div>
          <p className="text-sm leading-6 text-secondary">{t('overview.transparencyBody')}</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => navigate('verify')}>
            <ShieldCheck size={15} strokeWidth={1.75} />
            {t('overview.transparencyCta')}
          </button>
        </section>
      </div>

      <RulesSection games={overview.data?.games ?? []} />
    </div>
  );
}

function GameSummaryCard({
  game,
  locale,
  navigate,
}: {
  game: OverviewGame;
  locale: string;
  navigate: (route: AppRoute) => void;
}): JSX.Element {
  const { t } = useI18n();
  const isBall = game.gameType === 'BALL';
  const route: AppRoute = isBall ? 'ball' : '100k';
  const current = game.current !== null && !isPendingRound(game.current) ? game.current : null;

  return (
    <section className="glass glass-interactive flex flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('glass-icon h-11 w-11 shrink-0 rounded-2xl')}>
            {isBall ? <CircleDot size={22} strokeWidth={1.75} /> : <Trophy size={22} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {isBall ? t('overview.ballTitle') : t('overview.hundredTitle')}
            </h3>
            <p className="mt-0.5 max-w-xs text-xs leading-5 text-secondary">
              {isBall ? t('overview.ballSubtitle') : t('overview.hundredSubtitle')}
            </p>
          </div>
        </div>
        {current ? <DrawStatusBadge status={current.status} /> : null}
      </div>

      {current ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <MetricTile
              label={t('common.prizePool')}
              value={formatTon(current.totalBudget)}
              sub={`${t('common.round')} #${current.roundId}`}
            />
            <MetricTile
              label={t('common.ticketsSold')}
              value={formatInteger(current.totalTicketsSold, locale)}
              sub={`${t('common.threshold')} ${formatInteger(current.minThreshold ?? 10_000, locale)}`}
            />
            <MetricTile
              label={t('common.ticketPrice')}
              value={current.ticketPrice ? `${current.ticketPrice.ton} ${t('common.ton')}` : '—'}
              sub={t('common.ticketPrice')}
            />
            <MetricTile
              label={t('common.countdown')}
              value={<Countdown target={current.deadlineTimestamp} />}
              sub={t('common.deadline')}
            />
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="tabular">
                {formatInteger(current.totalTicketsSold, locale)} /{' '}
                {formatInteger(current.minThreshold ?? 10_000, locale)}
              </span>
              <span>{t('common.threshold')}</span>
            </div>
            <ProgressBar value={current.totalTicketsSold} max={current.minThreshold ?? 10_000} tone="success" />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">
              {t('common.round')} #{current.roundId}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(route)}>
              {t('overview.openGame')}
              <ArrowRight size={14} strokeWidth={1.75} />
            </button>
          </div>
        </>
      ) : (
        <WaitingForRoundCard gameLabel={isBall ? 'BALL' : '100K'} compact />
      )}
    </section>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }): JSX.Element {
  return (
    <div className="metric-tile flex min-w-0 flex-col gap-1 p-3">
      <div className="stat-label">{label}</div>
      <div className="truncate text-[1.05rem] font-semibold leading-6 tracking-tight tabular text-[var(--text-primary)]">
        {value}
      </div>
      {sub ? <div className="stat-sub truncate">{sub}</div> : null}
    </div>
  );
}

