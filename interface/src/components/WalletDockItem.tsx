import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
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
 * Viewport-anchored geometry for the connected-wallet popover.
 *
 * The panel is `fixed` and pinned with BOTH physical insets (`left-3 right-3`)
 * plus auto margins, so it is centred inside a box that is always at least
 * 12 px away from each viewport edge, and `w-[min(360px,calc(100vw-24px))]`
 * caps it at 360 px on desktop / `100vw-24px` on a 375–430 px iPhone. It is
 * deliberately NOT centred with `left-1/2 -translate-x-1/2`: the Liquid Glass
 * `fade-in` animation ends on `transform: translateY(0)` with
 * `animation-fill-mode: both`, and an animated transform overrides a utility
 * transform — the panel used to keep `left: 50%` and run ~86vw off the right
 * edge (clipping the card and letting the whole Mini App slide sideways).
 * Insets + auto margins are animation-proof.
 *
 * `max-h-[calc(100dvh-140px)] overflow-y-auto` keeps the card scrollable instead
 * of vertically clipped on short Telegram viewports, and the content below is
 * `min-w-0` / `truncate` guarded so nothing can widen the card.
 */
export const WALLET_POPOVER_CLASS = [
  'glass-popover wallet-popover fade-in fixed left-3 right-3 z-[60] mx-auto',
  'w-[min(360px,calc(100vw-24px))] max-w-[calc(100vw-24px)] min-w-0',
  'max-h-[calc(100dvh-140px)] overflow-x-clip overflow-y-auto overscroll-contain p-3',
].join(' ');

/**
 * Sits just above the floating dock on every device: `max(1rem,
 * env(safe-area-inset-bottom), var(--tg-safe-bottom))` is exactly the dock's
 * own bottom offset, and `+ 4.6rem` clears the ~3.9rem dock capsule plus a calm
 * gap (never under the iOS home indicator / Telegram bottom bar).
 */
export const WALLET_POPOVER_BOTTOM =
  'calc(max(1rem, env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px)) + 4.6rem)';

/**
 * Connected-wallet popover body. Exported so the layout contract (viewport
 * clamping, full shortened address, network pill, Copy + Disconnect) can be
 * asserted by a server-rendered unit test without a DOM.
 */
export function WalletMenuPopover({
  address,
  roleLabel,
  copied,
  panelRef,
  onCopy,
  onDisconnect,
}: {
  address: string;
  roleLabel: string | null;
  copied: boolean;
  panelRef?: Ref<HTMLDivElement>;
  onCopy: () => void;
  onDisconnect: () => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div
      ref={panelRef}
      className={WALLET_POPOVER_CLASS}
      style={{ bottom: WALLET_POPOVER_BOTTOM }}
      role="dialog"
      aria-label={t('common.walletMenu')}
      data-wallet-menu="popover"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="glass-icon h-9 w-9 shrink-0">
          <Wallet size={16} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow truncate">{t('common.connected')}</div>
          <div className="truncate text-sm font-semibold tabular text-[var(--text-primary)]">
            {shortAddress(address, 8, 8)}
          </div>
        </div>
        {roleLabel !== null ? (
          <span className="pill pill-neutral max-w-[40%] shrink-0 truncate">{roleLabel}</span>
        ) : null}
      </div>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-[var(--text-muted)]">{t('common.network')}</span>
        <span className="pill pill-neutral shrink-0">
          {NETWORK === 'testnet' ? t('common.testnet') : t('common.mainnet')}
        </span>
      </div>

      <button
        type="button"
        className="glass-row mt-2 flex w-full min-w-0 items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
        onClick={onCopy}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {copied ? (
            <Check className="shrink-0" size={14} strokeWidth={2} />
          ) : (
            <Copy className="shrink-0" size={14} strokeWidth={1.75} />
          )}
          <span className="truncate">{copied ? t('common.copied') : t('common.copy')}</span>
        </span>
        <span className="shrink-0 text-[var(--text-muted)]">{t('common.address')}</span>
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-sm btn-block mt-2 min-w-0"
        onClick={onDisconnect}
      >
        <LogOut className="shrink-0" size={14} strokeWidth={1.75} />
        <span className="min-w-0 truncate">{t('common.disconnect')}</span>
      </button>
    </div>
  );
}

/**
 * Fourth bottom-dock slot: the wallet lives here (it was removed from the top
 * header so the fullscreen Telegram pills can never overlap it).
 *
 * • Disconnected → a normal dock item labelled "Connect" that opens the TON
 *   Connect modal.
 * • Connected → the same dock item shows a quiet monochrome indicator dot plus
 *   the shortened address. Tapping opens a viewport-anchored Liquid Glass
 *   popover ABOVE the dock with the full shortened address, an admin/treasury
 *   role badge, the active network, Copy Address and Disconnect.
 *
 * The popover is rendered through a portal on `document.body`: the dock itself
 * is a `fixed` + `translate` element, so a nested `position: fixed` popover
 * would be positioned against the dock instead of the viewport. The portal
 * keeps it centred and clamped with >= 12 px side margins on any screen, and
 * `overflow-x: clip` on `html`/`body` guarantees the panel can never expand the
 * document width or make the page slide sideways.
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
      <WalletMenuPopover
        address={wallet}
        roleLabel={roleLabel}
        copied={copied === 'wallet'}
        panelRef={popover}
        onCopy={() => void copy(wallet, 'wallet')}
        onDisconnect={() => void disconnect()}
      />
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
