import { initializeRuntimeConfig } from '../lib/runtimeConfig';
import type {
  ChainTicketsResponse,
  CurrentDrawView,
  HealthResponse,
  HistoryResponse,
  OverviewResponse,
  TakenCombinationsResponse,
  VerifyResponse,
} from '../types/api';
import type { GameSlug } from '../types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const RETRY_DELAYS_MS = [350, 700, 1200] as const;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = (): void => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Anonymous, read-only API client.
 *
 * PRIVACY: the only address-bearing call is `fetchChainTickets`, which asks the
 * FRO4A read-only public mirror for the already-public on-chain ticket list of
 * one wallet. Nothing is stored as an identity: no cookies, no accounts, no IP
 * logs, no analytics.
 *
 * Reliability: 3 retries (350 / 700 / 1200 ms) on network errors and HTTP 5xx.
 * 4xx responses are authoritative and are never retried.
 */
async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Resolved once per page load. Production: runtime-config.json only (no
  // `?api=` / start-param / storage overrides — phishing lock-down).
  // Dev: localhost `?api=` override > runtime-config.json > storage >
  // VITE_API_BASE_URL. Empty = same-origin `/api/...`.
  const apiBaseUrl = await initializeRuntimeConfig();
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      try {
        await delay(RETRY_DELAYS_MS[attempt - 1], signal);
      } catch (error) {
        throw error;
      }
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'GET',
        signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          accept: 'application/json',
        },
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // keep HTTP status message
        }
        throw new ApiError(message, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError && error.status < 500) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError('Network unreachable', 0);
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return getJson<HealthResponse>('/health', signal);
}

export function fetchOverview(signal?: AbortSignal): Promise<OverviewResponse> {
  return getJson<OverviewResponse>('/api/overview', signal);
}

export function fetchCurrentDraw(game: GameSlug, signal?: AbortSignal): Promise<CurrentDrawView> {
  return getJson<CurrentDrawView>(`/api/games/${game}/current`, signal);
}

export function fetchHistory(game: GameSlug, limit = 20, page = 1, signal?: AbortSignal): Promise<HistoryResponse> {
  return getJson<HistoryResponse>(`/api/games/${game}/history?page=${page}&limit=${limit}`, signal);
}

export function fetchTakenCombinations(roundId: number, signal?: AbortSignal): Promise<TakenCombinationsResponse> {
  return getJson<TakenCombinationsResponse>(`/api/games/ball/taken-combinations/${roundId}`, signal);
}

export function fetchVerification(game: GameSlug, roundId: number, signal?: AbortSignal): Promise<VerifyResponse> {
  return getJson<VerifyResponse>(`/api/verify/${game}/${roundId}`, signal);
}

/**
 * Fast public ticket mirror: one PostgreSQL read (<20ms) instead of a browser
 * TonAPI scan. This is the only call that carries the connected public wallet
 * address; it is never logged by the server (logger: false, no URL logs).
 */
export function fetchChainTickets(walletAddress: string, signal?: AbortSignal): Promise<ChainTicketsResponse> {
  return getJson<ChainTicketsResponse>(`/api/chain/tickets/${encodeURIComponent(walletAddress)}`, signal);
}
