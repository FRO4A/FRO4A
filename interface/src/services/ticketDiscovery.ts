import { Cell } from '@ton/core';
import type { GameType, KnownDraw } from '../types/game';
import { addressKey, sameAddress } from '../utils/address';
import { ballTicketAddress } from './ballTicketAddress';
import { userQuotaAddress } from './quota';
import {
  fetchAccountTransactions,
  fetchTrace,
  stackCell,
  type TonApiNftItem,
  type TonApiTraceNode,
  type TonApiTransaction,
} from './tonapi';

/**
 * Deterministic, 100% client-side ticket discovery.
 *
 * WHY THIS EXISTS
 * ---------------
 * The deployed SBT child contracts do not expose the TEP-62 collection getters
 * (`get_collection_data` / `get_nft_address_by_index`), and `Ticket100kSBT.get_nft_data`
 * omits the content cell, so TonAPI never indexes these tickets as NFTs and
 * `/accounts/{wallet}/nfts` is empty. This module therefore rebuilds the wallet's
 * ticket list from raw public chain history:
 *
 *   1. For every known draw, compute the wallet's deterministic UserQuota shard
 *      address from the compiled quota code (`userQuotaAddress`). This value was
 *      verified against the live Testnet quota shards.
 *   2. Walk the draw's public transactions. The `QuotaGranted` transaction is the
 *      only transaction whose `in_msg.source` is that quota shard, and its single
 *      mint out-message points at the deterministic SBT:
 *         BALL  : out op 0x1004 (MintTicket)
 *         100K  : out op 0x4001 (TicketMinted)
 *   3. Every candidate is then verified with the live ticket getter, including the
 *      owner check, so a duplicate purchase (mint attempt against an SBT owned by
 *      somebody else) is rejected instead of being shown.
 *
 * Fallback: if a draw's history is not reachable, the wallet's own `BuyTicket`
 * (0x1001) traces are walked instead. Both paths are read-only public TonAPI calls
 * used ONLY when the fast server mirror is unreachable; the wallet address is
 * public on-chain data and is never logged by the FRO4A backend.
 */

export const BUY_TICKET_OPCODE = 0x1001;

/** draw -> SBT mint opcode (BALL `MintTicket`, 100K `TicketMinted`). */
export const SBT_MINT_OPCODE: Record<GameType, number> = {
  BALL: 0x1004,
  '100K': 0x4001,
};

const MAX_DRAW_PAGES = 4;
const MAX_TRACE_FALLBACKS = 12;

export interface TicketCandidate {
  ticketAddress: string;
  draw: KnownDraw;
  /** How the address was found (useful for diagnostics / the UI note). */
  source: 'nft' | 'quota-transactions' | 'trace' | 'wallet-payload';
}

/** Parses `"0x00001001"` / `"4097"` / `4097` into a number. */
export function parseOpcode(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    if (/^0x[0-9a-f]+$/i.test(trimmed)) return Number.parseInt(trimmed, 16);
    if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  } catch {
    return null;
  }
  return null;
}

function pushUnique(target: string[], value: string, seen: Set<string>): void {
  const key = addressKey(value) ?? value;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(value);
}

/**
 * Extracts SBT addresses from the draw's transactions:
 * only transactions sent by the wallet's deterministic quota shard are considered,
 * and only their mint out-message destination is returned.
 */
export function parseMintDestinations(
  gameType: GameType,
  transactions: readonly TonApiTransaction[],
  quotaAddress: string,
): string[] {
  const mintOpcode = SBT_MINT_OPCODE[gameType];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const transaction of transactions) {
    const source = transaction.in_msg?.source?.address;
    if (typeof source !== 'string' || !sameAddress(source, quotaAddress)) continue;
    for (const message of transaction.out_msgs ?? []) {
      const destination = message.destination?.address;
      if (typeof destination !== 'string') continue;
      if (parseOpcode(message.op_code) !== mintOpcode) continue;
      pushUnique(found, destination, seen);
    }
  }
  return found;
}

/** Recursively collects mint destinations from a TonAPI trace tree. */
export function parseTraceMintDestinations(
  gameType: GameType,
  root: TonApiTraceNode,
  limit = 64,
): string[] {
  const mintOpcode = SBT_MINT_OPCODE[gameType];
  const found: string[] = [];
  const seen = new Set<string>();
  const queue: TonApiTraceNode[] = [root];
  let visited = 0;
  while (queue.length > 0 && visited < limit) {
    const node = queue.shift() as TonApiTraceNode;
    visited += 1;
    for (const message of node.transaction?.out_msgs ?? []) {
      const destination = message.destination?.address;
      if (typeof destination !== 'string') continue;
      if (parseOpcode(message.op_code) !== mintOpcode) continue;
      pushUnique(found, destination, seen);
    }
    for (const child of node.children ?? []) queue.push(child);
  }
  return found;
}


/**
 * Wallet transactions that call `BuyTicket` on a known draw. Used as a fallback
 * when the draw transaction page cannot be read.
 */
export function parseBuyTicketCalls(
  transactions: readonly TonApiTransaction[],
  draws: readonly KnownDraw[],
): Array<{ hash: string; draw: KnownDraw }> {
  const calls: Array<{ hash: string; draw: KnownDraw }> = [];
  const seen = new Set<string>();
  for (const transaction of transactions) {
    if (typeof transaction.hash !== 'string' || seen.has(transaction.hash)) continue;
    for (const message of transaction.out_msgs ?? []) {
      if (parseOpcode(message.op_code) !== BUY_TICKET_OPCODE) continue;
      const destination = message.destination?.address;
      if (typeof destination !== 'string') continue;
      const draw = draws.find((candidate) => sameAddress(candidate.drawAddress, destination));
      if (!draw) continue;
      seen.add(transaction.hash);
      calls.push({ hash: transaction.hash, draw });
      break;
    }
  }
  return calls;
}

/** NFT list entries whose collection is one of our known draws. */
export function matchNftCandidates(
  nfts: readonly TonApiNftItem[],
  draws: readonly KnownDraw[],
): TicketCandidate[] {
  const candidates: TicketCandidate[] = [];
  const seen = new Set<string>();
  for (const nft of nfts) {
    const collection = nft.collection?.address;
    if (typeof collection !== 'string' || typeof nft.address !== 'string') continue;
    const draw = draws.find((candidate) => sameAddress(candidate.drawAddress, collection));
    if (!draw) continue;
    const key = addressKey(nft.address) ?? nft.address;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ ticketAddress: nft.address, draw, source: 'nft' });
  }
  return candidates;
}

async function collectDrawTransactions(
  drawAddress: string,
  signal?: AbortSignal,
): Promise<TonApiTransaction[]> {
  const collected: TonApiTransaction[] = [];
  let beforeLt: string | number | null = null;
  for (let page = 0; page < MAX_DRAW_PAGES; page += 1) {
    const batch = await fetchAccountTransactions(drawAddress, { limit: 100, beforeLt, signal });
    collected.push(...batch);
    if (batch.length < 100) break;
    const oldest = batch[batch.length - 1];
    if (!oldest?.lt) break;
    beforeLt = oldest.lt;
  }
  return collected;
}

/**
 * The primary deterministic discovery path: draw history + deterministic quota shard.
 * Each known draw costs 1–4 public TonAPI calls, independent of the number of tickets.
 */
export async function discoverTicketsFromQuotaShards(
  wallet: string,
  draws: readonly KnownDraw[],
  signal?: AbortSignal,
): Promise<TicketCandidate[]> {
  const candidates: TicketCandidate[] = [];
  const seen = new Set<string>();
  for (const draw of draws) {
    let quotaAddress: string;
    try {
      quotaAddress = userQuotaAddress(draw.gameType, draw.drawAddress, wallet);
    } catch {
      continue;
    }
    let transactions: TonApiTransaction[];
    try {
      transactions = await collectDrawTransactions(draw.drawAddress, signal);
    } catch {
      continue;
    }
    for (const ticketAddress of parseMintDestinations(draw.gameType, transactions, quotaAddress)) {
      const key = addressKey(ticketAddress) ?? ticketAddress;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ ticketAddress, draw, source: 'quota-transactions' });
    }
  }
  return candidates;
}

/**
 * Fallback discovery via the wallet's own public transaction traces.
 * Only used when the quota-shard scan finds nothing.
 */
export async function discoverTicketsFromTraces(
  wallet: string,
  draws: readonly KnownDraw[],
  signal?: AbortSignal,
): Promise<TicketCandidate[]> {
  let walletTransactions: TonApiTransaction[];
  try {
    walletTransactions = await fetchAccountTransactions(wallet, { limit: 100, signal });
  } catch {
    return [];
  }
  const calls = parseBuyTicketCalls(walletTransactions, draws).slice(0, MAX_TRACE_FALLBACKS);
  const candidates: TicketCandidate[] = [];
  const seen = new Set<string>();
  for (const call of calls) {
    try {
      const trace = await fetchTrace(call.hash, signal);
      for (const ticketAddress of parseTraceMintDestinations(call.draw.gameType, trace)) {
        const key = addressKey(ticketAddress) ?? ticketAddress;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ ticketAddress, draw: call.draw, source: 'trace' });
      }
    } catch {
      // rate limit / unavailable trace: keep the other candidates
    }
  }
  return candidates;
}

/** Deduplicates candidates by parsed address, preferring the first source. */
export function mergeTicketCandidates(candidates: readonly TicketCandidate[]): TicketCandidate[] {
  const merged: TicketCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = addressKey(candidate.ticketAddress) ?? candidate.ticketAddress;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
}

/**
 * Decodes a BALL `BuyTicket` body (0x1001, queryId:uint64, packedCombination:uint64).
 * Returns the packed combination, or `null` for any other/invalid body.
 */
export function decodeBallBuyPayload(cell: Cell): bigint | null {
  try {
    const slice = cell.beginParse();
    if (slice.remainingBits < 160) return null;
    if (slice.loadUint(32) !== BUY_TICKET_OPCODE) return null;
    slice.loadUintBig(64); // queryId
    return slice.loadUintBig(64);
  } catch {
    return null;
  }
}

export interface BallBuyPayload {
  draw: KnownDraw;
  packed: bigint;
}

/**
 * Every BALL `BuyTicket` the wallet ever sent to a known draw, decoded from the
 * public message body. Duplicates are collapsed (the same combination can be sent
 * more than once; only the first mint wins on-chain).
 */
export function parseBallBuyPayloads(
  transactions: readonly TonApiTransaction[],
  draws: readonly KnownDraw[],
): BallBuyPayload[] {
  const ballDraws = draws.filter((draw) => draw.gameType === 'BALL');
  const found: BallBuyPayload[] = [];
  const seen = new Set<string>();
  for (const transaction of transactions) {
    for (const message of transaction.out_msgs ?? []) {
      const destination = message.destination?.address;
      if (typeof destination !== 'string') continue;
      if (parseOpcode(message.op_code) !== BUY_TICKET_OPCODE) continue;
      const draw = ballDraws.find((candidate) => sameAddress(candidate.drawAddress, destination));
      if (!draw) continue;
      const raw = message.raw_body;
      if (typeof raw !== 'string' || raw.length === 0) continue;
      // TonAPI encodes message bodies as hex on Testnet and base64 on other hosts.
      const cell = stackCell({ type: 'cell', cell: raw });
      if (cell === null) continue;
      const packed = decodeBallBuyPayload(cell);
      if (packed === null) continue;
      const key = `${addressKey(draw.drawAddress) ?? draw.drawAddress}:${packed.toString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ draw, packed });
    }
  }
  return found;
}

/**
 * BALL fast path: one small wallet-history call -> local SBT address derivation.
 * Works even when the NFT index, the draw history or the traces are unavailable.
 */
export async function discoverBallTicketsFromWallet(
  wallet: string,
  draws: readonly KnownDraw[],
  signal?: AbortSignal,
): Promise<TicketCandidate[]> {
  const ballDraws = draws.filter((draw) => draw.gameType === 'BALL');
  if (ballDraws.length === 0) return [];

  const transactions: TonApiTransaction[] = [];
  let beforeLt: string | number | null = null;
  for (let page = 0; page < 3; page += 1) {
    let batch: TonApiTransaction[];
    try {
      batch = await fetchAccountTransactions(wallet, { limit: 100, beforeLt, signal });
    } catch {
      break;
    }
    transactions.push(...batch);
    if (batch.length < 100) break;
    const oldest = batch[batch.length - 1];
    if (!oldest?.lt) break;
    beforeLt = oldest.lt;
  }

  const candidates: TicketCandidate[] = [];
  const seen = new Set<string>();
  for (const payload of parseBallBuyPayloads(transactions, ballDraws)) {
    let ticketAddress: string;
    try {
      ticketAddress = ballTicketAddress(payload.draw.drawAddress, payload.packed);
    } catch {
      continue;
    }
    const key = addressKey(ticketAddress) ?? ticketAddress;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ ticketAddress, draw: payload.draw, source: 'wallet-payload' });
  }
  return candidates;
}

