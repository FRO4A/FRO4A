import { LogOut, ShieldAlert } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useI18n } from '../i18n';
import { formatV5Copy, v5Copy } from '../i18n/v5Messages';
import { useTonNetworkGuard } from '../hooks/useTonNetworkGuard';

/**
 * Non-dismissible wrong-network banner (Mainnet safety).
 *
 * The banner can only be removed by disconnecting the wallet: it is intentionally
 * not closable, so a Testnet wallet connected to a Mainnet app can never be
 * mistaken for a working session.
 */
export function WrongNetworkBanner(): JSX.Element | null {
  const { locale } = useI18n();
  const guard = useTonNetworkGuard();
  const [tonConnectUI] = useTonConnectUI();
  if (!guard.wrongNetwork) return null;

  const copy = v5Copy(locale);
  const walletNetwork = guard.walletChain === '-239' ? copy.mainnet : copy.testnet;
  const appNetwork = guard.network === 'mainnet' ? copy.mainnet : copy.testnet;

  return (
    <section
      className="glass mb-4 border-[var(--danger)]/40 p-3.5 sm:p-4"
      role="alert"
      aria-live="assertive"
      data-testid="wrong-network-banner"
      data-wallet-chain={guard.walletChain ?? ''}
      data-expected-chain={guard.expectedChain}
    >
      <div className="flex items-start gap-3">
        <span className="glass-icon h-10 w-10 shrink-0 rounded-2xl text-[var(--danger)]">
          <ShieldAlert size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{copy.wrongNetworkTitle}</h2>
          <p className="mt-1 text-xs leading-5 text-secondary">
            {formatV5Copy(copy.wrongNetworkBody, { wallet: walletNetwork, app: appNetwork })}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{copy.wrongNetworkHint}</p>
          <button
            type="button"
            className="btn btn-danger btn-sm mt-2.5"
            onClick={() => void tonConnectUI.disconnect()}
          >
            <LogOut size={14} strokeWidth={1.75} />
            {copy.wrongNetworkDisconnect}
          </button>
        </div>
      </div>
    </section>
  );
}
