import { House, LayoutGrid, Ticket } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useI18n } from '../i18n';
import { useApiResource } from '../hooks/useApiResource';
import { fetchChainTickets } from '../services/api';
import type { ChainTicketsResponse } from '../types/api';
import type { AppRoute } from '../types/game';
import { cn } from '../utils/cn';
import { WalletDockItem } from './WalletDockItem';

/**
 * The three navigation slots. Wallet is the fourth dock slot and is rendered by
 * <WalletDockItem />. `Verify` is no longer a dock tab: it now lives inside My
 * Tickets as a segmented sub-view, so `#/verify` keeps the My Tickets tab lit.
 */
export const DOCK_ITEMS: ReadonlyArray<{
  route: Extract<AppRoute, 'overview' | 'games' | 'tickets'>;
  key: 'home' | 'games' | 'tickets';
  icon: typeof House;
  activeRoutes: readonly AppRoute[];
  badge?: boolean;
}> = [
  { route: 'overview', key: 'home', icon: House, activeRoutes: ['overview'] },
  { route: 'games', key: 'games', icon: LayoutGrid, activeRoutes: ['games', 'ball', '100k'] },
  { route: 'tickets', key: 'tickets', icon: Ticket, activeRoutes: ['tickets', 'verify'], badge: true },
];

/**
 * Floating Liquid Glass navigation dock with four slots:
 * Overview · Games · My Tickets · Wallet.
 *
 * The badge uses the same read-only public mirror as My Tickets, but only reads
 * a count every 30s so it never duplicates the fast 3s ticket polling inside the
 * Tickets screen.
 */
export function BottomDock({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
}): JSX.Element {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const chain = useApiResource<ChainTicketsResponse | null>(
    (signal) => (wallet ? fetchChainTickets(wallet, signal) : Promise.resolve(null)),
    [wallet],
    30_000,
  );
  const ticketCount = (chain.data?.tickets.length ?? 0) + (chain.data?.packs.length ?? 0);

  return (
    <nav
      className="fixed left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 px-1"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px))' }}
      aria-label={t('common.mainNavigation')}
    >
      <div className="glass-dock flex items-stretch gap-1 p-1.5">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.activeRoutes.includes(route);
          const showBadge = item.badge === true && ticketCount > 0;
          return (
            <button
              key={item.route}
              type="button"
              className={cn('dock-item', active && 'dock-item-active')}
              onClick={() => navigate(item.route)}
              aria-current={active ? 'page' : undefined}
              aria-label={t(`nav.${item.key}`)}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.6} />
              <span className="dock-label">{t(`nav.${item.key}`)}</span>
              {showBadge ? <span className="dock-badge">{ticketCount > 99 ? '99+' : ticketCount}</span> : null}
            </button>
          );
        })}
        <WalletDockItem />
      </div>
    </nav>
  );
}
