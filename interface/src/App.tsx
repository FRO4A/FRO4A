import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { resolveManifestUrl } from './config/deployments';
import { I18nProvider } from './i18n/I18nProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { useHashRoute } from './hooks/useRoute';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { GamesPage } from './pages/GamesPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { VerifierPage } from './pages/VerifierPage';

function RoutedApp(): JSX.Element {
  const { route, navigate } = useHashRoute();
  return (
    <AppShell route={route} navigate={navigate}>
      {route === 'overview' ? <OverviewPage navigate={navigate} /> : null}
      {route === 'games' ? <GamesPage initialGame="BALL" navigate={navigate} /> : null}
      {route === 'ball' ? <GamesPage initialGame="BALL" navigate={navigate} /> : null}
      {route === '100k' ? <GamesPage initialGame="100K" navigate={navigate} /> : null}
      {route === 'tickets' ? <MyTicketsPage /> : null}
      {route === 'verify' ? <VerifierPage /> : null}
    </AppShell>
  );
}

/**
 * Root provider order is deliberate: TON Connect stays mounted for the whole
 * session, so SPA navigation can never disconnect the wallet.
 *
 * `twaReturnUrl` is required inside the Telegram Mini App: after signing in a
 * wallet app, Telegram re-opens https://t.me/fro4a_lottery_bot which forwards
 * the user straight back into the running Mini App (without it the Telegram
 * WebView is left on the connect screen and the session looks stuck).
 */
export default function App(): JSX.Element {
  return (
    <TonConnectUIProvider
      manifestUrl={resolveManifestUrl()}
      actionsConfiguration={{ twaReturnUrl: 'https://t.me/fro4a_lottery_bot' }}
    >
      <ThemeProvider>
        <I18nProvider>
          <RoutedApp />
        </I18nProvider>
      </ThemeProvider>
    </TonConnectUIProvider>
  );
}
