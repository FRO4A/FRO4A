import { useCallback } from 'react';
import { useApiResource } from './useApiResource';
import { fetchChainTickets } from '../services/api';
import type { ChainQuotasView } from '../types/api';

export interface WalletQuotaState {
  quotas: ChainQuotasView | null;
  indexedAt: string | null;
  loading: boolean;
  error: Error | null;
  reconnecting: boolean;
  refresh: () => void;
}

/**
 * Active-round `X / 100` quota from the fast public ticket mirror.
 *
 * The browser only falls back to the live UserQuota getter when this request
 * fails, so the normal path is one PostgreSQL read instead of a TonAPI call.
 */
export function useWalletQuota(wallet: string | null | undefined): WalletQuotaState {
  const resource = useApiResource<{ quotas: ChainQuotasView; indexedAt: string } | null>(
    async (signal) => {
      if (!wallet) return null;
      const response = await fetchChainTickets(wallet, signal);
      return { quotas: response.quotas, indexedAt: response.indexedAt };
    },
    [wallet],
    15_000,
  );

  const refresh = useCallback(() => resource.refresh(), [resource.refresh]);

  return {
    quotas: resource.data?.quotas ?? null,
    indexedAt: resource.data?.indexedAt ?? null,
    loading: resource.loading,
    error: resource.error,
    reconnecting: resource.reconnecting,
    refresh,
  };
}