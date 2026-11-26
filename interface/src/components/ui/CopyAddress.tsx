import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';
import { shortAddress } from '../../utils/address';
import { tonviewerAddressUrl } from '../../config/deployments';

export function useCopyToClipboard(): { copied: string | null; copy: (value: string, key?: string) => Promise<void> } {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key?: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(key ?? value);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
      window.alert(t('errors.copyFailed'));
    }
  };

  return { copied, copy };
}

export function CopyAddress({
  address,
  label,
  short = false,
  explorer = true,
  className,
}: {
  address: string;
  label?: string;
  short?: boolean;
  explorer?: boolean;
  className?: string;
}): JSX.Element {
  const { t } = useI18n();
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {label ? <span className="label">{label}</span> : null}
      <button
        type="button"
        className="copyable code min-w-0 text-[var(--text-primary)] hover:text-[var(--accent)]"
        onClick={() => void copy(address)}
        title={t('common.copy')}
      >
        <span className="truncate">{short ? shortAddress(address, 6, 6) : address}</span>
        {copied === address ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
      </button>
      {explorer ? (
        <a
          className="text-[var(--text-muted)] hover:text-[var(--accent)]"
          href={tonviewerAddressUrl(address)}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('common.viewExplorer')}
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </a>
      ) : null}
    </div>
  );
}
