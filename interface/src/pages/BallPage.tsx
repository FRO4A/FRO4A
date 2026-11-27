import { CircleDot, Info, ShieldCheck } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import type { AppRoute, QuotaView } from '../types/game';
import { DRAW_STATUS } from '../types/game';
import type { WinningNumbersView } from '../types/api';
import { useI18n } from '../i18n';
import { useApiResource } from '../hooks/useApiResource';
import { useRole } from '../hooks/useRole';
import { useTonNetworkGuard } from '../hooks/useTonNetworkGuard';
import { useWalletQuota } from '../hooks/useWalletQuota';
import { fetchCurrentDraw, fetchHistory, fetchTakenCombinations } from '../services/api';
import { readUserQuota } from '../services/quota';
import { ACTIVE_DEPLOYMENTS } from '../config/deployments';
import { pinnedAdminAddress, pinnedTreasuryAddress } from '../utils/governance';
import { isPendingRound } from '../utils/roundState';
import { formatInteger, formatTon } from '../utils/format';
import { AdminForceStartCard } from '../components/AdminForceStartCard';
import { AdminLaunchRoundCard } from '../components/AdminLaunchRoundCard';
import { AdminPanel } from '../components/AdminPanel';
import { BallPrizeTable } from '../components/BallPrizeTable';
import { BallPurchasePanel } from '../components/BallPurchasePanel';
import { ArchiveTable } from '../components/ArchiveTable';
import { RoleNotice } from '../components/RoleNotice';
import { WaitingForRoundCard } from '../components/WaitingForRoundCard';
import { BallSet } from '../components/ui/Ball';
import { Countdown } from '../components/ui/Countdown';
import { ProgressBar } from '../components/ui/ProgressBar';
import { DrawStatusBadge } from '../components/ui/StatusBadge';
import { ConnectionPill } from '../components/ui/ConnectionPill';
import { ErrorState, LoadingState } from '../components/ui/States';
import { SectionHeader } from '../components/ui/StatCard';

export function BallPage({ navigate }: { navigate: (route: AppRoute) => void }): JSX.Element {
  const { locale, t } = useI18n();
  const wallet = useTonAddress();
  const current = useApiResource((signal) => fetchCurrentDraw('ball', signal), [], 20_000);
  const history = useApiResource((signal) => fetchHistory('ball', 30, 1, signal), [], 60_000);
  const draw = current.data;

  // Instant X / 100 quota from the public mirror; on-chain getter only as fallback.
  const walletQuota = useWalletQuota(wallet);
  const quotaFallback = useApiResource<QuotaView>(
    (signal) =>
      wallet && draw && walletQuota.error !== null
        ? readUserQuota('BALL', draw.drawAddress, wallet, signal)
        : Promise.resolve({ count: 0, max: 100, address: null }),
    [wallet, draw?.drawAddress, walletQuota.error !== null],
    60_000,
  );
  const mirrorQuota = walletQuota.quotas?.ball;
  const quota: QuotaView | null =
    wallet && draw && mirrorQuota?.roundId === draw.roundId
      ? { count: mirrorQuota.used, max: 100, address: null }
      : walletQuota.error !== null
        ? quotaFallback.data
        : null;

  const taken = useApiResource(
    (signal) => (draw ? fetchTakenCombinations(draw.roundId, signal) : Promise.resolve(null)),
    [draw?.roundId, draw?.drawAddress],
    3_000,
  );

  const role = useRole(wallet, pinnedAdminAddress(), pinnedTreasuryAddress());
  const networkGuard = useTonNetworkGuard();
  // Strict admin UI: the ADMIN address AND the expected TON chain are required.
  const isAdmin = role === 'ADMIN' && !networkGuard.wrongNetwork;

  // Result panel: the CURRENT draw once the VRF landed (TALLYING / CLAIM_OPEN), or
  // the most recent finished round from the archive when round N+1 already started.
  const latestArchivedResult = history.data?.items.find((item) => item.winningNumbers !== null) ?? null;
  const resultPanel = draw !== null && draw.winningNumbers !== null ? draw : latestArchivedResult;

  const refreshAll = (): void => {
    current.refresh();
    walletQuota.refresh();
    quotaFallback.refresh();
    taken.refresh();
    history.refresh();
  };

  const openRules = (): void => {
    navigate('overview');
    window.setTimeout(() => document.getElementById('game-rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
  };

  if (current.loading && draw === null) {
    return <LoadingState title={t('common.loading')} body={t('ball.statsTitle')} />;
  }

  if (current.error !== null && draw === null) {
    return <ErrorState body={t('errors.api')} onRetry={current.refresh} />;
  }

  if (!draw || isPendingRound(draw)) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ball.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">{t('ball.subtitle')}</p>
        </div>
        <WaitingForRoundCard gameLabel="BALL" onRefresh={refreshAll}>
          {isAdmin ? (
            <AdminLaunchRoundCard
              gameType="BALL"
              factoryAddress={ACTIVE_DEPLOYMENTS.ballFactory}
              onDone={refreshAll}
            />
          ) : null}
        </WaitingForRoundCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConnectionPill
        visible={
          current.reconnecting ||
          taken.reconnecting ||
          walletQuota.reconnecting ||
          quotaFallback.reconnecting
        }
      />
      <section className="glass p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="glass-icon h-12 w-12 rounded-2xl">
              <CircleDot size={24} strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{t('ball.title')}</h1>
                <span className="pill pill-neutral">
                  {t('common.round')} #{draw.roundId}
                </span>
                <DrawStatusBadge status={draw.status} />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-secondary">{t('ball.subtitle')}</p>
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
            <div className="stat-label">{t('common.ticketsSold')}</div>
            <div className="stat-value">{formatInteger(draw.totalTicketsSold, locale)}</div>
            <div className="stat-sub">
              {t('common.threshold')} {formatInteger(draw.minThreshold ?? 10_000, locale)}
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
                {formatInteger(draw.totalTicketsSold, locale)} / {formatInteger(draw.minThreshold ?? 10_000, locale)}
              </span>
            </div>
            <ProgressBar value={draw.totalTicketsSold} max={draw.minThreshold ?? 10_000} tone="success" />
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              {draw.totalTicketsSold >= (draw.minThreshold ?? 10_000)
                ? t('status.activeSales')
                : `${formatInteger(Math.max(0, (draw.minThreshold ?? 10_000) - draw.totalTicketsSold), locale)} ${t('common.ticketsSold')}`}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('common.prizePool')}</span>
              <span className="tabular">{formatTon(draw.rolloverJackpot)}</span>
            </div>
            <div className="glass-nested px-3 py-2 text-xs text-secondary">
              {t('common.winners')}:{' '}
              {formatInteger(
                draw.categories.reduce((sum, category) => sum + category.winners, 0),
                locale,
              )}
            </div>
          </div>
        </div>

        {draw.status === DRAW_STATUS.SALES_CLOSED || draw.status === DRAW_STATUS.TALLYING ? (
          <div className="glass-nested mt-3 flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-secondary">
            <span className="font-semibold text-[var(--text-primary)]">
              {draw.status === DRAW_STATUS.TALLYING ? t('ball.tallyingTitle') : t('ball.statsTitle')}
            </span>
            {draw.tallyDeadline ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[var(--text-muted)]">{t('ball.tallyClosesIn')}</span>
                <Countdown target={draw.tallyDeadline} className="font-semibold" />
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {resultPanel ? (
        <BallResultPanel
          roundId={resultPanel.roundId}
          status={resultPanel.status}
          winningNumbers={resultPanel.winningNumbers}
          winnerCount={
            resultPanel.winnerCount ??
            resultPanel.categories.reduce((sum, category) => sum + category.winners, 0)
          }
          tallyDeadline={resultPanel.tallyDeadline}
          claimDeadline={resultPanel.claimDeadline ?? resultPanel.expiryTimestamp}
          rolloverInTon={resultPanel.rolloverIn?.ton ?? null}
          rolloverOutTon={resultPanel.rolloverOut?.ton ?? null}
          onVerify={() => navigate('verify')}
        />
      ) : null}

      {isAdmin ? (
        <>
          <AdminForceStartCard gameType="BALL" draw={draw} onDone={refreshAll} />
          <AdminPanel
            gameType="BALL"
            draw={draw}
            factoryAddress={ACTIVE_DEPLOYMENTS.ballFactory}
            onDone={refreshAll}
            hideForceStart
          />
        </>
      ) : null}

      {role !== 'ADMIN' ? <RoleNotice role={role} /> : null}

      {role === 'BUYER' || role === 'GUEST' ? (
        <BallPurchasePanel
          draw={draw}
          wallet={wallet}
          quota={wallet ? quota : null}
          taken={taken.data}
          onPurchased={refreshAll}
          onRefresh={refreshAll}
        />
      ) : null}

      <section className="glass p-4 sm:p-5">
        <SectionHeader title={t('ball.prizeTableTitle')} subtitle={t('ball.prizeTableIntro')} />
        <BallPrizeTable categories={draw.categories} />
        <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">{t('ball.rolloverNote')}</p>
      </section>

      <section className="glass p-4 sm:p-5">
        <SectionHeader
          title={t('ball.archiveTitle')}
          subtitle={t('ball.archiveIntro')}
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
        {history.data ? <ArchiveTable gameType="BALL" items={history.data.items} onVerify={() => navigate('verify')} /> : null}
      </section>
    </div>
  );
}

/**
 * Result block for a drawn BALL round.
 *
 * Renders the 5 white + 1 red balls, the total winner count (including a clean
 * "0 winners — rolled over to Round N+1"), the rollover amounts and the live
 * tally / claim countdown. Used for the current TALLYING draw and for the most
 * recent finished round from the archive.
 */
function BallResultPanel({
  roundId,
  status,
  winningNumbers,
  winnerCount,
  tallyDeadline,
  claimDeadline,
  rolloverInTon,
  rolloverOutTon,
  onVerify,
}: {
  roundId: number;
  status: number;
  winningNumbers: WinningNumbersView | null;
  winnerCount: number;
  tallyDeadline: string | null;
  claimDeadline: string | null;
  rolloverInTon: string | null;
  rolloverOutTon: string | null;
  onVerify: () => void;
}): JSX.Element {
  const { locale, t } = useI18n();
  if (!winningNumbers) return <></>;
  const tallying = status === DRAW_STATUS.TALLYING;
  return (
    <section className="glass p-4 sm:p-5">
      <SectionHeader
        title={`${t('ball.latestResult')} · #${roundId}`}
        subtitle={tallying ? t('ball.tallyingTitle') : t('ball.latestResultIntro')}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={onVerify}>
            <ShieldCheck size={15} strokeWidth={1.75} />
            {t('nav.verify')}
          </button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-nested p-3">
          <div className="stat-label mb-1">{t('ball.winnerOfDraw')}</div>
          <BallSet whites={winningNumbers.whites} red={winningNumbers.red} />
        </div>
        <div className="glass-nested space-y-1.5 p-3 text-sm">
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-[var(--text-muted)]">{t('ball.winnersTotal')}</span>
            <span className="font-semibold tabular text-[var(--text-primary)]">
              {formatInteger(winnerCount, locale)}
            </span>
          </div>
          {winnerCount === 0 ? (
            <p className="text-xs text-[var(--warning)]">
              {t('ball.noWinners')} #{roundId + 1}
            </p>
          ) : null}
          {rolloverInTon ? (
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-[var(--text-muted)]">{t('ball.rolloverInLabel')}</span>
              <span className="font-semibold tabular text-[var(--text-primary)]">{rolloverInTon} {t('common.ton')}</span>
            </div>
          ) : null}
          {rolloverOutTon ? (
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-[var(--text-muted)]">{t('ball.rolloverOutLabel')}</span>
              <span className="font-semibold tabular text-[var(--text-primary)]">{rolloverOutTon} {t('common.ton')}</span>
            </div>
          ) : null}
          {tallying && tallyDeadline ? (
            <div className="text-xs">
              <div className="text-[var(--text-muted)]">{t('ball.tallyClosesIn')}</div>
              <Countdown target={tallyDeadline} className="font-semibold" />
            </div>
          ) : null}
          {status === DRAW_STATUS.CLAIM_OPEN && claimDeadline ? (
            <div className="text-xs">
              <div className="text-[var(--text-muted)]">{t('ball.claimClosesIn')}</div>
              <Countdown target={claimDeadline} className="font-semibold" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
