import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MyTicketsPage } from '../pages/MyTicketsPage';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/locales/en';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ticketsViewForRoute, type TicketsView } from '../utils/ticketsView';

vi.mock('@tonconnect/ui-react', () => ({
  useTonAddress: () => null,
  useTonConnectUI: () => [{ openModal: () => undefined, disconnect: async () => undefined }],
}));

function renderPage(view?: TicketsView): string {
  return renderToStaticMarkup(
    <ThemeProvider>
      <I18nProvider>
        <MyTicketsPage view={view} onViewChange={() => undefined} />
      </I18nProvider>
    </ThemeProvider>,
  );
}

describe('My Tickets — Verify nested as a top sub-view', () => {
  it('shows the Verify toggle at the very top and defaults to the tickets list', () => {
    const html = renderPage();
    const switcherIndex = html.indexOf('tickets-view-switcher');

    expect(switcherIndex).toBeGreaterThanOrEqual(0);
    // The switcher is the first block: it precedes the page heading.
    expect(html.indexOf(en.tickets.subtitle)).toBeGreaterThan(switcherIndex);
    expect(html).toContain('data-view="tickets" data-active="true"');
    expect(html).toContain('data-view="verify" data-active="false"');
    expect(html).toContain(en.nav.verify);
    expect(html).toContain(en.tickets.connectTitle);
  });

  it('renders the full VRF verifier inside the same container when Verify is active', () => {
    const html = renderPage('verify');

    expect(html).toContain('data-view="verify" data-active="true"');
    expect(html).toContain('data-view="tickets" data-active="false"');
    expect(html).toContain(en.verify.title);
    expect(html.indexOf(en.verify.title)).toBeGreaterThan(html.indexOf('tickets-view-switcher'));
    // The tickets list is not rendered while verifying.
    expect(html).not.toContain(en.tickets.connectTitle);
  });

  it('maps the #/verify CTA/deep link to My Tickets with Verify open', () => {
    // Every "Verify a draw" CTA (Overview, BALL, 100K, archive tables) still
    // navigates to `verify`; the route now resolves to the My Tickets tab with
    // the Verify sub-view already open.
    expect(ticketsViewForRoute('verify')).toBe('verify');
    expect(ticketsViewForRoute('tickets')).toBe('tickets');
    expect(ticketsViewForRoute('overview')).toBe('tickets');
    expect(renderPage(ticketsViewForRoute('verify'))).toContain('data-view="verify" data-active="true"');
  });
});
