import { useState, type ReactNode } from 'react';
import { CircleDot, Coins, Info, Lock, Scale, ShieldCheck, Timer, Trophy } from 'lucide-react';
import type { GameType } from '../types/game';
import { useI18n } from '../i18n';
import { ACTIVE_DEPLOYMENTS, NETWORK } from '../config/deployments';
import { buildDrawContractRows, type LiveGameSnapshot } from '../utils/drawContracts';
import { CopyAddress } from './ui/CopyAddress';
import { cn } from '../utils/cn';

/**
 * Scrollable "Game Rules" block for the Overview screen. Replaces the former
 * standalone Rules/Info route; every card is an independent Liquid Glass panel.
 *
 * `games` is the live `/api/overview` snapshot: the Verified contracts card
 * always renders the CURRENT draw address and round of every game present in
 * the API (BALL, 100K and any future game), falling back to the deployment
 * manifest only until that snapshot has loaded.
 */
export function RulesSection({ games = [] }: { games?: readonly LiveGameSnapshot[] }): JSX.Element {
  const { t } = useI18n();
  const [game, setGame] = useState<GameType>('BALL');

  const isBall = game === 'BALL';
  const drawRows = buildDrawContractRows(games, ACTIVE_DEPLOYMENTS);

  const mechanics = isBall ? t('info.ballRules') : t('info.hundredRules');
  const prizes = isBall ? t('info.ballPayoutRows') : t('info.hundredPayoutRows');
  const fairness = (
    isBall
      ? [t('info.principles')[5], t('info.timersRows')[1], t('info.ballRules')[5], t('info.ballRules')[6]]
      : [t('info.principles')[5], t('info.timersRows')[1], t('info.hundredRules')[5], t('info.hundredRules')[6], t('info.hundredRules')[7]]
  ).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const refunds = [t('overview.rulesRefund24h'), ...t('info.refundsRows')];

  return (
    <section id="game-rules" className="scroll-mt-24 space-y-3">
      <div className="glass p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-1 flex items-center gap-2">
              <span className="glass-icon h-8 w-8 rounded-xl">
                <Info size={16} strokeWidth={1.75} />
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {t('overview.rulesTitle')}
              </h2>
            </div>
            <p className="text-sm leading-6 text-secondary">{t('overview.rulesIntro')}</p>
          </div>
          <div className="glass-pill shrink-0 self-start p-1" role="tablist" aria-label={t('overview.rulesTabsLabel')}>
            {(['BALL', '100K'] as const).map((tab) => {
              const active = game === tab;
              const Icon = tab === 'BALL' ? CircleDot : Trophy;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--accent-rim)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                  onClick={() => setGame(tab)}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RuleCard
          icon={<CircleDot size={16} strokeWidth={1.75} />}
          title={t('overview.rulesMechanics')}
          intro={t('overview.rulesMechanicsIntro')}
          items={mechanics}
        />
        <RuleCard
          icon={<Coins size={16} strokeWidth={1.75} />}
          title={t('overview.rulesPrizes')}
          intro={isBall ? t('info.ballPayoutIntro') : t('info.hundredPayoutIntro')}
          items={prizes}
        />
        <RuleCard
          icon={<ShieldCheck size={16} strokeWidth={1.75} />}
          title={t('overview.rulesFairness')}
          intro={t('overview.rulesFairnessIntro')}
          items={fairness}
        />
        <RuleCard
          icon={<Scale size={16} strokeWidth={1.75} />}
          title={t('overview.rulesRefunds')}
          intro={t('overview.rulesRefundsIntro')}
          items={refunds}
        />
        <RuleCard
          icon={<Coins size={16} strokeWidth={1.75} />}
          title={t('info.pricingTitle')}
          intro={t('info.pricingIntro')}
          items={t('info.pricingRows')}
        />
        <RuleCard
          icon={<Timer size={16} strokeWidth={1.75} />}
          title={t('info.timersTitle')}
          intro={t('info.timersIntro')}
          items={t('info.timersRows')}
        />
        <RuleCard
          icon={<Lock size={16} strokeWidth={1.75} />}
          title={t('info.privacyTitle')}
          intro={t('info.privacyIntro')}
          items={t('info.privacyRows')}
        />

        <section className="glass min-w-0 p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="glass-icon h-8 w-8 rounded-xl">
              <ShieldCheck size={16} strokeWidth={1.75} />
            </span>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('info.contractsTitle')}</h3>
          </div>
          <p className="text-sm leading-6 text-secondary">{t('info.contractsIntro')}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="pill pill-neutral">
              {t('info.networkLabel')}: {NETWORK === 'testnet' ? t('common.testnet') : t('common.mainnet')}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">{t('common.anonymously')}</p>

          <div className="mt-3 grid gap-2">
            {ACTIVE_DEPLOYMENTS.ballFactory ? (
              <ContractRow label={t('info.ballFactory')} address={ACTIVE_DEPLOYMENTS.ballFactory} />
            ) : null}
            {ACTIVE_DEPLOYMENTS.draw100kFactory ? (
              <ContractRow label={t('info.hundredFactory')} address={ACTIVE_DEPLOYMENTS.draw100kFactory} />
            ) : null}
            {drawRows.map((row) => (
              <ContractRow
                key={row.key}
                label={t('info.drawRoundLabel', { game: row.gameType, round: row.roundId })}
                address={row.drawAddress}
              />
            ))}
            {ACTIVE_DEPLOYMENTS.adminAddress ? (
              <ContractRow label={t('info.adminLabel')} address={ACTIVE_DEPLOYMENTS.adminAddress} />
            ) : null}
            {ACTIVE_DEPLOYMENTS.treasuryAddress ? (
              <ContractRow label={t('info.treasuryLabel')} address={ACTIVE_DEPLOYMENTS.treasuryAddress} />
            ) : null}
            {ACTIVE_DEPLOYMENTS.vrfPublicKey ? (
              <div className="glass-nested p-3">
                <div className="stat-label mb-1">{t('info.vrfKeyLabel')}</div>
                <div className="code break-all text-xs text-[var(--text-primary)]">{ACTIVE_DEPLOYMENTS.vrfPublicKey}</div>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">{t('info.copyHint')}</p>
        </section>
      </div>

      <p className="px-1 text-xs leading-5 text-[var(--text-muted)]">{t('info.disclaimer')}</p>
    </section>
  );
}

function RuleCard({
  icon,
  title,
  intro,
  items,
}: {
  icon: ReactNode;
  title: string;
  intro: string;
  items: string[];
}): JSX.Element {
  return (
    <section className="glass rules-card p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="glass-icon h-8 w-8 rounded-xl">{icon}</span>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <p className="mb-3 text-sm leading-6 text-secondary">{intro}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="rule-item">
            <span className="rule-dot" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContractRow({ label, address }: { label: string; address: string }): JSX.Element {
  return (
    <div className="glass-nested p-3">
      <div className="stat-label mb-1">{label}</div>
      <CopyAddress address={address} short className="text-xs" />
    </div>
  );
}
