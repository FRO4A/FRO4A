import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BottomDock, DOCK_ITEMS } from '../components/BottomDock';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/locales/en';
import { ThemeProvider } from '../theme/ThemeProvider';
import { shortAddress } from '../utils/address';

// The wallet hook is the only TON Connect dependency of the dock; a tiny mock
// keeps the server-rendered test free of a wallet provider.
const wallet = vi.hoisted(() => ({ address: null as string | null }));

vi.mock('@tonconnect/ui-react', () => ({
  useTonAddress: () => wallet.address,
  useTonConnectUI: () => [{ openModal: () => undefined, disconnect: async () => undefined }],
}));

function renderDock(route: 'overview' | 'games' | 'tickets' | 'verify' = 'tickets'): string {
  return renderToStaticMarkup(
    <ThemeProvider>
      <I18nProvider>
        <BottomDock route={route} navigate={() => undefined} />
      </I18nProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  wallet.address = null;
});

describe('BottomDock — Overview · Games · My Tickets · Wallet', () => {
  it('renders exactly four slots and no standalone Verify tab', () => {
    const html = renderDock('tickets');
    const slots = html.match(/class="dock-item[^"]*"/g) ?? [];

    expect(slots).toHaveLength(4);
    expect(html).toContain(`>${en.nav.home}<`);
    expect(html).toContain(`>${en.nav.games}<`);
    expect(html).toContain(`>${en.nav.tickets}<`);
    expect(html).toContain(`>${en.common.connectShort}<`);
    expect(html).not.toContain(`aria-label="${en.nav.verify}"`);
    expect(DOCK_ITEMS.map((item) => item.route)).toEqual(['overview', 'games', 'tickets']);
    expect(DOCK_ITEMS.some((item) => (item.route as string) === 'verify')).toBe(false);
  });

  it('places the wallet slot last and opens TON Connect while disconnected', () => {
    const html = renderDock('overview');
    const ticketsIndex = html.indexOf(`aria-label="${en.nav.tickets}"`);
    const walletIndex = html.indexOf('data-wallet-state="disconnected"');

    expect(ticketsIndex).toBeGreaterThanOrEqual(0);
    expect(walletIndex).toBeGreaterThan(ticketsIndex);
    expect(html).toContain(`aria-label="${en.common.connectWallet}"`);
    expect(html).not.toContain('dock-connected-dot');
  });

  it('shows the shortened address and a monochrome indicator when connected', () => {
    wallet.address = 'EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d';
    const html = renderDock('tickets');

    expect((html.match(/class="dock-item[^"]*"/g) ?? []).length).toBe(4);
    expect(html).toContain('data-wallet-state="connected"');
    expect(html).toContain(shortAddress(wallet.address, 4, 4));
    expect(html).toContain('dock-connected-dot');
    expect(html).toContain(`aria-label="${en.common.walletMenu}"`);
    expect(html).not.toContain(`>${en.common.connectShort}<`);
  });

  it('keeps My Tickets highlighted on the #/verify deep link', () => {
    const html = renderDock('verify');

    expect(html).toContain(`aria-current="page" aria-label="${en.nav.tickets}"`);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });
});
