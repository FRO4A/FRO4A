import { ShieldAlert, Wallet } from 'lucide-react';
import { useI18n } from '../i18n';
import type { UserRole } from '../types/game';

export function RoleNotice({ role }: { role: UserRole }): JSX.Element | null {
  const { t } = useI18n();
  if (role !== 'ADMIN' && role !== 'TREASURY') return null;
  const admin = role === 'ADMIN';
  return (
    <div className="glass p-4 sm:p-5" role="note">
      <div className="flex items-start gap-3">
        <div className="glass-icon h-10 w-10 shrink-0 rounded-2xl">
          {admin ? <ShieldAlert size={20} strokeWidth={1.75} /> : <Wallet size={20} strokeWidth={1.75} />}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {admin ? t('roles.adminTitle') : t('roles.treasuryTitle')}
            </h2>
            <span className="pill pill-accent">{admin ? t('roles.adminBadge') : t('roles.treasuryBadge')}</span>
          </div>
          <p className="mt-1 text-sm text-secondary">{admin ? t('roles.adminNotice') : t('roles.treasuryNotice')}</p>
        </div>
      </div>
    </div>
  );
}
