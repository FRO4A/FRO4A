import {
  sendTransaction,
  type GuardedDrawTarget,
  type TransactionMessage,
  type TransactionSender,
} from './tonConnect';

/**
 * Multi-message TON Connect batching.
 *
 * A single `sendTransaction` can carry several internal messages (one wallet
 * confirmation). The wallet advertises how many it accepts through its
 * `SendTransaction` feature (`wallet.device.features[].maxMessages`):
 *   • W5 wallets usually report 255
 *   • older wallets report 1–4 or nothing at all
 *
 * Unknown capabilities safely default to 4 and larger purchases are split into
 * sequential batches with explicit UI progress instead of failing in the wallet.
 */

export const DEFAULT_MAX_MESSAGES = 4;
export const ABSOLUTE_MAX_MESSAGES = 255;

export interface WalletFeatureShape {
  name?: string;
  maxMessages?: number;
}

/** Structural view of `useTonWallet()` — avoids depending on SDK internals. */
export interface WalletShape {
  device?: {
    features?: ReadonlyArray<WalletFeatureShape | string>;
  } | null;
}

/** `SendTransaction.maxMessages` from the connected wallet, clamped and defaulted. */
export function maxMessagesForWallet(wallet: WalletShape | null | undefined): number {
  const features = wallet?.device?.features ?? [];
  for (const feature of features) {
    if (typeof feature === 'string') {
      if (feature === 'SendTransaction') return DEFAULT_MAX_MESSAGES;
      continue;
    }
    if (feature !== null && typeof feature === 'object' && feature.name === 'SendTransaction') {
      const limit = feature.maxMessages;
      if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 1) {
        return Math.min(Math.floor(limit), ABSOLUTE_MAX_MESSAGES);
      }
      return DEFAULT_MAX_MESSAGES;
    }
  }
  return DEFAULT_MAX_MESSAGES;
}

export interface MessageBatch<T> {
  /** 1-based batch number. */
  index: number;
  total: number;
  items: T[];
}

/** Splits messages into wallet-sized batches (never empty, never above 255). */
export function chunkMessages<T>(messages: readonly T[], maxMessages: number): MessageBatch<T>[] {
  if (messages.length === 0) return [];
  const raw = Number.isFinite(maxMessages) ? Math.trunc(maxMessages) : DEFAULT_MAX_MESSAGES;
  const size = Math.max(1, Math.min(raw >= 1 ? raw : DEFAULT_MAX_MESSAGES, ABSOLUTE_MAX_MESSAGES));
  const chunks: MessageBatch<T>[] = [];
  for (let offset = 0; offset < messages.length; offset += size) {
    chunks.push({ index: chunks.length + 1, total: 0, items: messages.slice(offset, offset + size) });
  }
  return chunks.map((chunk) => ({ ...chunk, total: chunks.length }));
}

export interface BatchProgress {
  /** 1-based index of the batch that is being signed. */
  batch: number;
  total: number;
  ticketsInBatch: number;
  ticketsSent: number;
  ticketsTotal: number;
}

/**
 * Sends every batch sequentially. Each batch is one wallet confirmation; the next
 * one is only requested after the previous signature succeeded.
 *
 * When `drawTarget` is supplied, the canonical on-chain draw address is verified
 * before the first prompt (and served from cache for the remaining batches).
 */
export async function sendBatchedTransactions(
  sender: TransactionSender,
  batches: readonly MessageBatch<TransactionMessage>[],
  onProgress?: (progress: BatchProgress) => void,
  drawTarget?: GuardedDrawTarget,
): Promise<string[]> {
  if (batches.length === 0) throw new Error('No messages to send');
  const ticketsTotal = batches.reduce((sum, batch) => sum + batch.items.length, 0);
  const bocs: string[] = [];
  let sent = 0;
  for (const batch of batches) {
    onProgress?.({
      batch: batch.index,
      total: batch.total,
      ticketsInBatch: batch.items.length,
      ticketsSent: sent,
      ticketsTotal,
    });
    const result = await sendTransaction(sender, batch.items, drawTarget);
    bocs.push(result.boc);
    sent += batch.items.length;
  }
  return bocs;
}
