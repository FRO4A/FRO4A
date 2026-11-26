import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, LogOut, Wallet } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useI18n } from '../i18n';
import { NETWORK } from '../config/deployments';
import type { AppRoute } from '../types/game';
import { shortAddress } from '../utils/address';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

/**
 * Slim floating wordmark bar. There is deliberately no background strip, no
 * divider and no navigation here: primary navigation lives in the floating
 * bottom dock. The right-hand cluster is permanently mounted and can never be
 * hidden by a responsive class or clipped by an overflow container.
 */
export function Header({ navigate }: { route: AppRoute; navigate: (route: AppRoute) => void }): JSX.Element {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 safe-top bg-transparent px-4 pb-2 pt-3">
      <div className="mx-auto flex w-full max-w-content items-center gap-2">
        <button
          type="button"
          className="min-w-0 shrink rounded-full px-1 py-1 text-left"
          onClick={() => navigate('overview')}
          aria-label={t('common.appName')}
        >
          <span className="block whitespace-nowrap text-[0.95rem] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--text-primary)] sm:text-[1.05rem] sm:tracking-[0.26em]">
            {t('common.appName')}
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <WalletMenu />
        </div>
      </div>
    </header>
  );
}

function WalletMenu(): JSX.Element {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent): void => {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!wallet) setOpen(false);
  }, [wallet]);

  const copy = useCallback(async (): Promise<void> => {
    if (!wallet) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wallet);
      } else {
        const area = document.createElement('textarea');
        area.value = wallet;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [wallet]);

  const disconnect = async (): Promise<void> => {
    try {
      await tonConnectUI.disconnect();
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={container}>
      <button
        type="button"
        className="glass-pill h-[2.375rem] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--hairline-strong)]"
        onClick={() => (wallet ? setOpen((value) => !value) : tonConnectUI.openModal())}
        aria-label={wallet ? t('common.walletMenu') : t('common.connectWallet')}
        aria-expanded={wallet ? open : undefined}
        aria-haspopup={wallet ? 'dialog' : undefined}
      >
        <Wallet size={15} strokeWidth={1.75} className="shrink-0" />
        <span className="max-w-[4.5rem] truncate tabular">
          {wallet ? shortAddress(wallet, 4, 4) : t('common.connectShort')}
        </span>
      </button>

      {wallet && open ? (
        <div
          className="glass-popover fade-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[17rem] p-3"
          role="dialog"
          aria-label={t('common.walletMenu')}
        >
          <div className="flex items-center gap-2.5">
            <span className="glass-icon h-9 w-9">
              <Wallet size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="eyebrow">{t('common.connected')}</div>
              <div className="truncate text-sm font-semibold tabular text-[var(--text-primary)]">
                {shortAddress(wallet, 8, 8)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-muted)]">{t('common.network')}</span>
            <span className="pill pill-neutral">
              {NETWORK === 'testnet' ? t('common.testnet') : t('common.mainnet')}
            </span>
          </div>

          <button
            type="button"
            className="glass-row mt-2 flex w-full items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
            onClick={() => void copy()}
          >
            <span className="flex items-center gap-1.5">
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
              {copied ? t('common.copied') : t('common.copy')}
            </span>
            <span className="text-[var(--text-muted)]">{t('common.address')}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block mt-2"
            onClick={() => void disconnect()}
          >
            <LogOut size={14} strokeWidth={1.75} />
            {t('common.disconnect')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
