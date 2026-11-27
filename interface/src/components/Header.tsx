import { useI18n } from '../i18n';
import type { AppRoute } from '../types/game';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

/**
 * Centered floating wordmark bar.
 *
 * Telegram Mini App fullscreen reserves the top corners for its native
 * `× Close` (top-left) and `⌄ …` (top-right) pills, each ~85–95 px wide. The
 * header therefore renders one compact, horizontally centred cluster —
 * `[Theme] [FRO4A] [Language]` (~143 px with 36 px circles and 8 px gaps) — and
 * keeps >= 92 px of horizontal clearance on phones, so it can never be
 * overlapped by those native controls in fullscreen mode, in the normal
 * Telegram modal mode, or on desktop. The cluster also respects the device
 * notch (`env(safe-area-inset-top)`) and Telegram's `safeAreaInset.top`
 * (`--tg-safe-top`).
 *
 * There is deliberately no background strip, no divider and no wallet button:
 * primary navigation lives in the floating bottom dock and the wallet lives in
 * that dock's fourth slot.
 */
export function Header({ navigate }: { navigate: (route: AppRoute) => void }): JSX.Element {
  const { t } = useI18n();
  return (
    <header
      className="sticky top-0 z-40 bg-transparent px-3 pb-1.5"
      style={{
        // Device notch + Telegram's own top inset, never below 8 px so the
        // cluster keeps a calm optical margin in a regular browser.
        paddingTop: 'max(0.5rem, env(safe-area-inset-top), var(--tg-safe-top, 0px))',
      }}
    >
      <div className="mx-auto flex w-full max-w-content items-center justify-center px-[92px] sm:px-6">
        <div className="header-cluster flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <button
            type="button"
            className="min-w-0 shrink-0 rounded-full px-1 py-1 text-center"
            onClick={() => navigate('overview')}
            aria-label={t('common.appName')}
          >
            <span className="block whitespace-nowrap text-[0.9rem] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--text-primary)] sm:text-[1rem] sm:tracking-[0.24em]">
              {t('common.appName')}
            </span>
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
