import type { ReactNode } from 'react';
import type { AppRoute } from '../types/game';
import { useTelegramShell } from '../hooks/useTelegram';
import { Header } from './Header';
import { BottomDock } from './BottomDock';
import { MountainBackground } from './MountainBackground';

export function AppShell({
  route,
  navigate,
  children,
}: {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  children: ReactNode;
}): JSX.Element {
  useTelegramShell();
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <MountainBackground />
      <Header route={route} navigate={navigate} />
      <main className="mx-auto w-full max-w-content flex-1 px-4 pb-28 pt-2 sm:px-6 sm:pb-32">
        <div key={route} className="fade-in">
          {children}
        </div>
      </main>
      <BottomDock route={route} navigate={navigate} />
    </div>
  );
}

