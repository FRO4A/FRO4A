import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * Subtle, non-intrusive stale-while-revalidate indicator. It is rendered only
 * after a background poll failed; the last good data stays on screen.
 */
export function ConnectionPill({ visible }: { visible: boolean }): JSX.Element | null {
  const { t } = useI18n();
  if (!visible) return null;
  return (
    <div className="flex justify-end" role="status" aria-live="polite">
      <span className="pill pill-neutral">
        <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
        {t('common.reconnecting')}
      </span>
    </div>
  );
}
