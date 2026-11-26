import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';

export function LoadingState({ title, body, className }: { title?: string; body?: string; className?: string }): JSX.Element {
  return (
    <div className={cn('glass p-6', className)} aria-busy="true">
      {title ? <div className="mb-1 text-base font-semibold">{title}</div> : null}
      {body ? <p className="mb-4 text-sm text-secondary">{body}</p> : null}
      <div className="space-y-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  className,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className={cn('glass p-6', className)} role="alert">
      <div className="mb-2 flex items-center gap-2 text-[var(--warning)]">
        <AlertTriangle size={18} strokeWidth={1.75} />
        <div className="text-base font-semibold text-[var(--text-primary)]">{title ?? t('common.error')}</div>
      </div>
      {body ? <p className="text-sm text-secondary">{body}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>
          <RefreshCw size={15} strokeWidth={1.75} />
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: JSX.Element;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('glass-nested flex flex-col items-center px-5 py-8 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fill-subtle)] text-[var(--text-muted)]">
        <Inbox size={20} strokeWidth={1.75} />
      </div>
      <div className="text-base font-semibold text-[var(--text-primary)]">{title}</div>
      {body ? <p className="mt-1 max-w-md text-sm text-secondary">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
