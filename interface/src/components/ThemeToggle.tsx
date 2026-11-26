import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';

export function ThemeToggle(): JSX.Element {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="glass-circle shrink-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      onClick={toggleTheme}
      aria-label={t('theme.toggleLabel')}
      title={dark ? t('theme.light') : t('theme.dark')}
    >
      {dark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
    </button>
  );
}
