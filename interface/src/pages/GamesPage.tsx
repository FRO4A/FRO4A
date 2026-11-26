import { useState } from 'react';
import { CircleDot, Trophy } from 'lucide-react';
import type { AppRoute, GameType } from '../types/game';
import { useI18n } from '../i18n';
import { cn } from '../utils/cn';
import { BallPage } from './BallPage';
import { HundredKPage } from './HundredKPage';

const GAMES: ReadonlyArray<{ type: GameType; icon: typeof CircleDot }> = [
  { type: 'BALL', icon: CircleDot },
  { type: '100K', icon: Trophy },
];

/**
 * Interactive Games hub: one floating glass segmented switcher above the
 * selected game, so both lotteries are reachable with a single thumb tap.
 */
export function GamesPage({
  initialGame,
  navigate,
}: {
  initialGame: GameType;
  navigate: (route: AppRoute) => void;
}): JSX.Element {
  const { t } = useI18n();
  const [game, setGame] = useState<GameType>(initialGame);

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div
          className="glass-pill flex w-full max-w-sm items-center gap-1 p-1"
          role="tablist"
          aria-label={t('games.switchLabel')}
        >
          {GAMES.map((item) => {
            const Icon = item.icon;
            const active = game === item.type;
            return (
              <button
                key={item.type}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--accent-rim)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
                onClick={() => setGame(item.type)}
              >
                <Icon size={16} strokeWidth={1.75} />
                {item.type}
              </button>
            );
          })}
        </div>
      </div>

      {game === 'BALL' ? <BallPage navigate={navigate} /> : <HundredKPage navigate={navigate} />}
    </div>
  );
}
