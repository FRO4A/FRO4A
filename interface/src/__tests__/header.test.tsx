import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../components/Header';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/locales/en';
import { ThemeProvider } from '../theme/ThemeProvider';

/**
 * The top header must stay inside the corridor Telegram's native fullscreen
 * `× Close` / `⌄ …` pills leave free, and the wallet must no longer live there.
 *
 * Components are rendered with `renderToStaticMarkup` (node environment, no
 * jsdom) — markup order is enough to prove the visual order and the absence of
 * the wallet control, and no browser APIs are required.
 */
function renderHeader(): string {
  return renderToStaticMarkup(
    <ThemeProvider>
      <I18nProvider>
        <Header navigate={() => undefined} />
      </I18nProvider>
    </ThemeProvider>,
  );
}

describe('Header — centered fullscreen-safe cluster', () => {
  it('renders the theme toggle LEFT of the FRO4A wordmark and language RIGHT of it', () => {
    const html = renderHeader();
    const themeIndex = html.indexOf(en.theme.toggleLabel);
    const brandIndex = html.indexOf(`aria-label="${en.common.appName}"`);
    const languageIndex = html.indexOf(en.language.open);

    expect(themeIndex).toBeGreaterThanOrEqual(0);
    expect(brandIndex).toBeGreaterThan(themeIndex);
    expect(languageIndex).toBeGreaterThan(brandIndex);
  });

  it('does NOT render a wallet connect / connected-wallet button', () => {
    const html = renderHeader();

    expect(html).not.toContain('lucide-wallet');
    expect(html).not.toContain(en.common.connectShort);
    expect(html).not.toContain(en.common.connectWallet);
    expect(html).not.toContain(en.common.walletMenu);
    expect(html).not.toContain(en.common.connected);
    // Exactly three controls: theme, brand, language.
    expect((html.match(/<button/g) ?? []).length).toBe(3);
  });

  it('keeps a compact centered cluster with horizontal + vertical safe areas', () => {
    const html = renderHeader();

    expect(html).toContain('header-cluster');
    expect(html).toContain('gap-2');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('justify-center');
    // >= 92 px clearance on each side: clear of the Telegram native pills.
    expect(html).toContain('px-[92px]');
    // Respects both the device notch and Telegram's own `safeAreaInset.top`.
    expect(html).toContain('env(safe-area-inset-top)');
    expect(html).toContain('--tg-safe-top');
  });
});
