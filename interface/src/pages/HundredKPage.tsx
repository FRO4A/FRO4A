import { Info, ShieldCheck, Trophy } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import type { AppRoute, QuotaView } from '../types/game';
import { PROTOCOL_LIMITS } from '../types/game';
import { useI18n } from '../i18n';
import { useApiResource } from '../hooks/useApiResource';
import { useRole } from '../hooks/useRole';
import { useTonNetworkGuard } from '../hooks/useTonNetworkGuard';
import { useWalletQuota } from '../hooks/useWalletQuota';
import { fetchCurrentDraw, fetchHistory } from '../services/api';
import { readUserQuota } from '../services/quota';
import { ACTIVE_DEPLOYMENTS } from '../config/deployments';
import { isPendingRound } from '../utils/roundState';
import { formatInteger, formatTon } from '../utils/format';
import { AdminForceStartCard } from '../components/AdminForceStartCard';
import { AdminLaunchRoundCard } from '../components/AdminLaunchRoundCard';
import { AdminPanel } from '../components/AdminPanel';
import { ArchiveTable } from '../components/ArchiveTable';
import { HundredKPlaceTable } from '../components/HundredKPlaceTable';
import { HundredKPurchasePanel } from '../components/HundredKPurchasePanel';
import { RoleNotice } from '../components/RoleNotice';
import { WaitingForRoundCard } from '../components/WaitingForRoundCard';
import { Countdown } from '../components/ui/Countdown';
import { ProgressBar } from '../components/ui/ProgressBar';
import { DrawStatusBadge } from '../components/ui/StatusBadge';
import { ConnectionPill } from '../components/ui/ConnectionPill';
import { ErrorState, LoadingState } from '../components/ui/States';
import { SectionHeader } from '../components/ui/StatCard';

export function HundredKPage({ navigate }: { navigate: (route: AppRoute) => void }): JSX.Element {
  const { locale, t } = useI18n();
  const wallet = useTonAddress();
  const current = useApiResource((signal) => fetchCurrentDraw('100k', signal), [], 20_000);
  const history = useApiResource((signal) => fetchHistory('100k', 30, 1, signal), [], 60_000);
  const draw = current.data;

  // Instant X / 100 quota from the public mirror; on-chain getter only as fallback.
  const walletQuota = useWalletQuota(wallet);
  const quotaFallback = useApiResource<QuotaView>(
    (signal) =>
      wallet && draw && walletQuota.error !== null
        ? readUserQuota('100K', draw.drawAddress, wallet, signal)
        : Promise.resolve({ count: 0, max: 100, address: null }),
    [wallet, draw?.drawAddress, walletQuota.error !== null],
    60_000,
  );
  const mirrorQuota = walletQuota.quotas?.draw100k;
  const quota: QuotaView | null =
    wallet && draw && mirrorQuota?.roundId === draw.roundId
      ? { count: mirrorQuota.used, max: 100, address: null }
      : walletQuota.error !== null
        ? quotaFallback.data
        : null;

  const role = useRole(
    wallet,
    draw?.adminAddress ?? ACTIVE_DEPLOYMENTS.adminAddress,
    draw?.treasuryAddress ?? ACTIVE_DEPLOYMENTS.treasuryAddress,
  );
  const networkGuard = useTonNetworkGuard();
  // Strict admin UI: the ADMIN address AND the expected TON chain are required.
  const isAdmin = role === 'ADMIN' && !networkGuard.wrongNetwork;

  const refreshAll = (): void => {
    current.refresh();
    walletQuota.refresh();
    quotaFallback.refresh();
    history.refresh();
  };

  const openRules = (): void => {
    navigate('overview');
    window.setTimeout(() => document.getElementById('game-rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
  };

  if (current.loading && draw === null) {
    return <LoadingState title={t('common.loading')} body={t('hundredK.statsTitle')} />;
  }

  if (current.error !== null && draw === null) {
    return <ErrorState body={t('errors.api')} onRetry={current.refresh} />;
  }

  if (!draw || isPendingRound(draw)) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('hundredK.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">{t('hundredK.subtitle')}</p>
        </div>
        <WaitingForRoundCard gameLabel="100K" onRefresh={refreshAll}>
          {isAdmin ? (
            <AdminLaunchRoundCard
              gameType="100K"
              factoryAddress={ACTIVE_DEPLOYMENTS.draw100kFactory}
              onDone={refreshAll}
            />
          ) : null}
        </WaitingForRoundCard>
      </div>
    );
  }

  const hardCap = draw.hardCap ?? PROTOCOL_LIMITS.HARD_CAP_100K;
  const threshold = draw.minThreshold ?? PROTOCOL_LIMITS.MIN_THRESHOLD;

  return (
    <div className="space-y-5">
      <ConnectionPill visible={current.reconnecting || walletQuota.reconnecting || quotaFallback.reconnecting} />
      <section className="glass p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="glass-icon h-12 w-12 rounded-2xl">
              <Trophy size={24} strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{t('hundredK.title')}</h1>
                <span className="pill pill-neutral">
                  {t('common.round')} #{draw.roundId}
                </span>
                <DrawStatusBadge status={draw.status} />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-secondary">{t('hundredK.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-ghost btn-sm" onClick={openRules}>
              <Info size={15} strokeWidth={1.75} />
              {t('common.learnRules')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('verify')}>
              <ShieldCheck size={15} strokeWidth={1.75} />
              {t('nav.verify')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="metric-tile p-3">
            <div className="stat-label">{t('common.prizePool')}</div>
            <div className="stat-value">{formatTon(draw.totalBudget)}</div>
            <div className="stat-sub">
              {t('common.round')} #{draw.roundId}
            </div>
          </div>
          <div className="metric-tile p-3">
            <div className="stat-label">{t('hundredK.soldLabel')}</div>
            <div className="stat-value">{formatInteger(draw.totalTicketsSold, locale)}</div>
            <div className="stat-sub">
              {t('hundredK.remainingLabel')}: {formatInteger(Math.max(0, hardCap - draw.totalTicketsSold), locale)}
            </div>
          </div>
          <div className="metric-tile p-3">
            <div className="stat-label">{t('common.ticketPrice')}</div>
            <div className="stat-value">{draw.ticketPrice ? draw.ticketPrice.ton : '—'}</div>
            <div className="stat-sub">{t('common.ton')}</div>
          </div>
          <div className="metric-tile p-3">
            <div className="stat-label">{t('common.countdown')}</div>
            <div className="mt-1 text-sm font-semibold">
              <Countdown target={draw.deadlineTimestamp} />
            </div>
            <div className="stat-sub">{t('common.deadline')}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('common.threshold')}</span>
              <span className="tabular">
                {formatInteger(draw.totalTicketsSold, locale)} / {formatInteger(threshold, locale)}
              </span>
            </div>
            <ProgressBar value={draw.totalTicketsSold} max={threshold} tone="success" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('common.hardCap')}</span>
              <span className="tabular">
                {formatInteger(draw.totalTicketsSold, locale)} / {formatInteger(hardCap, locale)}
              </span>
            </div>
            <ProgressBar value={draw.totalTicketsSold} max={hardCap} />
          </div>
        </div>

        {draw.winningTickets && draw.winningTickets.tickets.length > 0 ? (
          <div className="glass-nested mt-3 p-3">
            <div className="stat-label mb-1">{t('hundredK.winnersDrawn')}</div>
            <div className="flex flex-wrap gap-1.5 text-xs tabular">
              {draw.winningTickets.tickets.slice(0, 12).map((number, index) => (
                <span key={`${number}-${index}`} className="pill pill-neutral">
                  #{number.toString().padStart(6, '0')}
                </span>
              ))}
              {draw.winningTickets.tickets.length > 12 ? <span className="text-[var(--text-muted)]">…</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      {isAdmin ? (
        <>
          <AdminForceStartCard gameType="100K" draw={draw} onDone={refreshAll} />
          <AdminPanel
            gameType="100K"
            draw={draw}
            factoryAddress={ACTIVE_DEPLOYMENTS.draw100kFactory}
            onDone={refreshAll}
            hideForceStart
          />
        </>
      ) : null}

      {role !== 'ADMIN' ? <RoleNotice role={role} /> : null}

      {role === 'BUYER' || role === 'GUEST' ? (
        <HundredKPurchasePanel
          draw={draw}
          wallet={wallet}
          quota={wallet ? quota : null}
          onPurchased={refreshAll}
          onRefresh={refreshAll}
        />
      ) : null}

      <section className="glass p-4 sm:p-5">
        <SectionHeader title={t('hundredK.placesTitle')} subtitle={t('hundredK.placesIntro')} />
        <HundredKPlaceTable places={draw.places} />
      </section>

      <section className="glass p-4 sm:p-5">
        <SectionHeader
          title={t('hundredK.archiveTitle')}
          subtitle={t('hundredK.archiveIntro')}
          action={
            <button type="button" className="btn btn-ghost btn-sm" onClick={history.refresh}>
              {t('common.refresh')}
            </button>
          }
        />
        {history.loading && history.data === null ? <LoadingState /> : null}
        {history.error !== null && history.data === null ? (
          <ErrorState body={t('errors.api')} onRetry={history.refresh} />
        ) : null}
        {history.data ? <ArchiveTable gameType="100K" items={history.data.items} onVerify={() => navigate('verify')} /> : null}
      </section>
    </div>
  );
}
