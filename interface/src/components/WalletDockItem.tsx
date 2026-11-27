import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, LogOut, Wallet } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useI18n } from '../i18n';
import { ACTIVE_DEPLOYMENTS, NETWORK } from '../config/deployments';
import { useRole } from '../hooks/useRole';
import { shortAddress } from '../utils/address';
import { cn } from '../utils/cn';
import { useCopyToClipboard } from './ui/CopyAddress';

/**
 * Fourth bottom-dock slot: the wallet lives here (it was removed from the top
 * header so the fullscreen Telegram pills can never overlap it).
 *
 * • Disconnected → a normal dock item labelled "Connect" that opens the TON
 *   Connect modal.
 * • Connected → the same dock item shows a quiet monochrome indicator dot plus
 *   the shortened address. Tapping opens a viewport-clamped Liquid Glass
 *   popover ABOVE the dock with the full shortened address, an admin/treasury
 *   role badge, the active network, Copy Address and Disconnect.
 *
 * The popover is rendered through a portal on `document.body`: the dock itself
 * is a `fixed` + `translate` element, so a nested `position: fixed` popover
 * would be positioned against the dock instead of the viewport and could clip
 * off narrow (375 px) screens or RTL layouts. The portal keeps it centred and
 * clamped with `w-[min(86vw,17rem)]`.
 */
export function WalletDockItem(): JSX.Element {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const role = useRole(wallet, ACTIVE_DEPLOYMENTS.adminAddress, ACTIVE_DEPLOYMENTS.treasuryAddress);
  const container = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (container.current?.contains(target) === true) return;
      if (popover.current?.contains(target) === true) return;
      setOpen(false);
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

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await tonConnectUI.disconnect();
    } finally {
      setOpen(false);
    }
  }, [tonConnectUI]);

  const roleLabel =
    role === 'ADMIN' ? t('roles.adminBadge') : role === 'TREASURY' ? t('roles.treasuryBadge') : null;

  const popoverContent =
    wallet && open ? (
      <div
        ref={popover}
        className="glass-popover fade-in fixed left-1/2 z-[60] w-[min(86vw,17rem)] -translate-x-1/2 p-3"
        style={{
          // Sits just above the floating dock on every device, including the
          // Telegram safe area and the iOS home indicator.
          bottom: 'calc(max(1rem, env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px)) + 4.85rem)',
        }}
        role="dialog"
        aria-label={t('common.walletMenu')}
      >
        <div className="flex items-center gap-2.5">
          <span className="glass-icon h-9 w-9 shrink-0">
            <Wallet size={16} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">{t('common.connected')}</div>
            <div className="truncate text-sm font-semibold tabular text-[var(--text-primary)]">
              {shortAddress(wallet, 8, 8)}
            </div>
          </div>
          {roleLabel !== null ? <span className="pill pill-neutral shrink-0">{roleLabel}</span> : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--text-muted)]">{t('common.network')}</span>
          <span className="pill pill-neutral">{NETWORK === 'testnet' ? t('common.testnet') : t('common.mainnet')}</span>
        </div>

        <button
          type="button"
          className="glass-row mt-2 flex w-full items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
          onClick={() => void copy(wallet, 'wallet')}
        >
          <span className="flex items-center gap-1.5">
            {copied === 'wallet' ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
            {copied === 'wallet' ? t('common.copied') : t('common.copy')}
          </span>
          <span className="text-[var(--text-muted)]">{t('common.address')}</span>
        </button>

        <button type="button" className="btn btn-secondary btn-sm btn-block mt-2" onClick={() => void disconnect()}>
          <LogOut size={14} strokeWidth={1.75} />
          {t('common.disconnect')}
        </button>
      </div>
    ) : null;

  return (
    <div className="relative flex min-w-0 flex-1" ref={container}>
      <button
        type="button"
        className={cn('dock-item w-full', open && 'dock-item-active')}
        onClick={() => (wallet ? setOpen((value) => !value) : tonConnectUI.openModal())}
        aria-label={wallet ? t('common.walletMenu') : t('common.connectWallet')}
        aria-expanded={wallet ? open : undefined}
        aria-haspopup={wallet ? 'dialog' : undefined}
        data-wallet-state={wallet ? 'connected' : 'disconnected'}
      >
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <Wallet size={18} strokeWidth={wallet ? 2 : 1.6} />
          {wallet ? <span className="dock-connected-dot" aria-hidden="true" /> : null}
        </span>
        <span className="dock-label tabular">{wallet ? shortAddress(wallet, 4, 4) : t('common.connectShort')}</span>
      </button>

      {popoverContent !== null && typeof document !== 'undefined' ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}
