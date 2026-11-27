import { Cell } from '@ton/core';
import { TONAPI_BASE_URL, TONAPI_KEY } from '../config/deployments';

export interface TonApiStackItem {
  type: 'cell' | 'num' | 'nan' | 'null' | 'tuple' | string;
  cell?: string;
  slice?: string;
  num?: string;
  tuple?: TonApiStackItem[];
  /** Legacy/alternate field name used by some TonAPI deployments. */
  value?: string;
}

function stackCellValue(item: TonApiStackItem | undefined): string | null {
  if (!item || item.type === 'null') return null;
  if (typeof item.cell === 'string' && item.cell.length > 0) return item.cell;
  if (typeof item.slice === 'string' && item.slice.length > 0) return item.slice;
  if (typeof item.value === 'string' && item.value.length > 0) return item.value;
  return null;
}

/**
 * TonAPI returns BOCs either hex-encoded (`cell` in the public testnet API) or
 * base64-encoded (`te6cc…`). Accept both, preferring the encoding that parses.
 */
function cellFromEncoded(value: string): Cell | null {
  const candidates: Buffer[] = [];
  if (/^[0-9a-f]+$/i.test(value) && value.length % 2 === 0) candidates.push(Buffer.from(value, 'hex'));
  candidates.push(Buffer.from(value, 'base64'));
  for (const candidate of candidates) {
    if (candidate.length === 0) continue;
    try {
      return Cell.fromBoc(candidate)[0];
    } catch {
      // try the next encoding
    }
  }
  return null;
}

interface TonApiRunResult {
  stack?: TonApiStackItem[];
  exit_code?: number;
  exitCode?: number;
  gas_used?: number;
}

export interface TonApiRunResponse {
  stack: TonApiStackItem[];
  exitCode: number;
  gasUsed: number;
}

function headers(): Record<string, string> {
  const result: Record<string, string> = { accept: 'application/json' };
  if (TONAPI_KEY.length > 0) result.authorization = `Bearer ${TONAPI_KEY}`;
  return result;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const onAbort = (): void => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await fetch(url, {
      headers: headers(),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`TonAPI HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Calls a contract getter through public TonAPI.
 *
 * TonAPI accepts getter arguments as a comma-separated list of decimal integers
 * (`?args=123,456`). This is used by the BALL duplicate guard:
 *   BallDrawInstance.getTicketAddress(packedCombination) -> deterministic BallTicket address
 */
export async function runGetter(
  address: string,
  method: string,
  signal?: AbortSignal,
  args: readonly (string | number | bigint)[] = [],
): Promise<TonApiRunResponse> {
  const query =
    args.length > 0
      ? `?args=${args.map((value) => encodeURIComponent(value.toString())).join(',')}`
      : '';
  const url = `${TONAPI_BASE_URL}/blockchain/accounts/${encodeURIComponent(address)}/methods/${encodeURIComponent(method)}${query}`;
  const payload = await fetchJson<TonApiRunResult>(url, signal);
  const stack = Array.isArray(payload.stack) ? payload.stack : [];
  const exitCode = typeof payload.exit_code === 'number' ? payload.exit_code : (payload.exitCode ?? 0);
  return { stack, exitCode, gasUsed: payload.gas_used ?? 0 };
}

/** Subset of a TonAPI message used by the client-side ticket discovery. */
export interface TonApiMessage {
  source?: { address?: string } | null;
  destination?: { address?: string } | null;
  value?: number | string;
  op_code?: string | null;
  /** Base64 BOC of the message body (present in transaction lists). */
  raw_body?: string | null;
  created_lt?: number;
  hash?: string;
}

/** Subset of a TonAPI transaction used by the client-side ticket discovery. */
export interface TonApiTransaction {
  hash?: string;
  lt?: number | string;
  utime?: number;
  success?: boolean;
  in_msg?: TonApiMessage | null;
  out_msgs?: TonApiMessage[] | null;
}

interface TonApiTransactionList {
  transactions?: TonApiTransaction[];
}

export interface FetchTransactionsOptions {
  limit?: number;
  /** LT cursor: return transactions older than this logical time. */
  beforeLt?: string | number | null;
  signal?: AbortSignal;
}

/**
 * Public transaction history of an account. Used to derive the deterministic
 * ticket addresses a wallet minted — never sent to the FRO4A backend.
 */
export async function fetchAccountTransactions(
  address: string,
  options: FetchTransactionsOptions = {},
): Promise<TonApiTransaction[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.beforeLt !== null && options.beforeLt !== undefined) {
    params.set('before_lt', String(options.beforeLt));
  }
  const url = `${TONAPI_BASE_URL}/blockchain/accounts/${encodeURIComponent(address)}/transactions?${params.toString()}`;
  const payload = await fetchJson<TonApiTransactionList>(url, options.signal);
  return Array.isArray(payload.transactions) ? payload.transactions : [];
}

export interface TonApiAccountState {
  status?: string;
  balance?: number | string;
}

/**
 * Account state (`active`, `uninit`, `frozen`, `nonexistent`). A deterministic
 * V5 BallTicket address that was never minted reports `uninit` — or is absent
 * with HTTP 404 — which is exactly what the BALL duplicate guard needs.
 *
 * Returns `null` when TonAPI has no account entity (never deployed).
 */
export async function fetchAccountState(
  address: string,
  signal?: AbortSignal,
): Promise<TonApiAccountState | null> {
  const url = `${TONAPI_BASE_URL}/blockchain/accounts/${encodeURIComponent(address)}`;
  try {
    return await fetchJson<TonApiAccountState>(url, signal);
  } catch (error) {
    if (error instanceof Error && /HTTP 404/.test(error.message)) return null;
    throw error;
  }
}

/** One node of a TonAPI trace (`/v2/traces/{hash}`). */
export interface TonApiTraceNode {
  transaction: TonApiTransaction;
  children?: TonApiTraceNode[] | null;
}

export async function fetchTrace(hash: string, signal?: AbortSignal): Promise<TonApiTraceNode> {
  const url = `${TONAPI_BASE_URL}/traces/${encodeURIComponent(hash)}`;
  return fetchJson<TonApiTraceNode>(url, signal);
}

export function stackNumber(item: TonApiStackItem | undefined): bigint | null {
  if (!item) return null;
  if (item.type === 'null') return null;
  const rawValue = item.num ?? item.value;
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    const raw = rawValue.trim();
    try {
      if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw);
      if (/^-?\d+$/.test(raw)) return BigInt(raw);
    } catch {
      return null;
    }
  }
  const encoded = stackCellValue(item);
  if (encoded === null) return null;
  const cell = cellFromEncoded(encoded);
  if (cell === null) return null;
  try {
    return cell.beginParse().loadUintBig(Math.min(256, cell.bits.length));
  } catch {
    return null;
  }
}

export function stackCell(item: TonApiStackItem | undefined): Cell | null {
  const encoded = stackCellValue(item);
  if (encoded === null) return null;
  return cellFromEncoded(encoded);
}

export function stackAddress(item: TonApiStackItem | undefined) {
  const cell = stackCell(item);
  if (cell === null) return null;
  try {
    return cell.beginParse().loadAddress();
  } catch {
    return null;
  }
}

export function readSnakeString(cell: Cell): string {
  const chunks: number[] = [];
  let current: Cell | null = cell;
  let guard = 0;
  while (current !== null && guard < 32) {
    const slice = current.beginParse();
    const bytes = Math.floor(slice.remainingBits / 8);
    if (bytes > 0) chunks.push(...slice.loadBuffer(bytes));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
    guard += 1;
  }
  return Buffer.from(chunks).toString('utf8');
}
