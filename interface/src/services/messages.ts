import { beginCell, Cell } from '@ton/core';
import type { GameType } from '../types/game';
import { OPCODES, V4_LIMITS } from './opcodes';

export function nextQueryId(): bigint {
  return BigInt(Date.now());
}

/** BALL `BuyTicket` (0x1001): queryId:uint64, packedCombination:uint64. */
export function buildBallBuyTicket(packedCombination: bigint, queryId: bigint = nextQueryId()): Cell {
  return beginCell()
    .storeUint(OPCODES.BuyTicket, 32)
    .storeUint(queryId, 64)
    .storeUint(packedCombination, 64)
    .endCell();
}

/** 100K `BuyTicket` (0x1001): queryId:uint64 only (the number is assigned on-chain). */
export function buildHundredKBuyTicket(queryId: bigint = nextQueryId()): Cell {
  return beginCell().storeUint(OPCODES.BuyTicket, 32).storeUint(queryId, 64).endCell();
}

const UINT64_MASK = (1n << 64n) - 1n;

function uniqueQueryId(base: bigint, index: number): bigint {
  return (base + BigInt(index)) & UINT64_MASK;
}

/**
 * N BALL `BuyTicket` payloads in basket order, each with a strictly unique
 * queryId (`baseQueryId + i`). All messages go to the same draw, so the batch
 * can be packed into one wallet confirmation (or chunked, see `tonTransactions`).
 */
export function buildBallBuyTicketBatch(
  packedCombinations: readonly bigint[],
  baseQueryId: bigint = nextQueryId(),
): Cell[] {
  return packedCombinations.map((packed, index) => buildBallBuyTicket(packed, uniqueQueryId(baseQueryId, index)));
}

/** N 100K `BuyTicket` payloads, each with a unique queryId. */
export function buildHundredKBuyTicketBatch(count: number, baseQueryId: bigint = nextQueryId()): Cell[] {
  const safeCount = Math.max(0, Math.trunc(count));
  return Array.from({ length: safeCount }, (_, index) =>
    buildHundredKBuyTicket(uniqueQueryId(baseQueryId, index)),
  );
}

/**
 * BALL V4 `BuyTicketBatch (0x1011)` — ONE message for up to 12 combinations.
 *
 * TL-B (shared/wrappers/ball `storeBuyTicketBatch`):
 *   opcode:uint32 = 0x1011, queryId:uint64, count:uint8,
 *   combinations:^Cell{ count × packedCombination:uint64 }
 */
export function buildBallBatchMessage(
  packedCombinations: readonly bigint[],
  queryId: bigint = nextQueryId(),
): Cell {
  const count = Math.min(Math.max(packedCombinations.length, 1), V4_LIMITS.MAX_BALL_BATCH);
  const list = packedCombinations.slice(0, count);
  const combinations = beginCell();
  for (const packed of list) combinations.storeUint(packed, 64);
  return beginCell()
    .storeUint(OPCODES.BuyTicketBatch, 32)
    .storeUint(queryId, 64)
    .storeUint(list.length, 8)
    .storeRef(combinations.endCell())
    .endCell();
}

/**
 * V4 basket -> contract messages: chunks of up to `MAX_BALL_BATCH (12)`
 * combinations, each chunk ONE `BuyTicketBatch` cell with a unique queryId.
 */
export function buildBallBatchMessages(
  packedCombinations: readonly bigint[],
  baseQueryId: bigint = nextQueryId(),
): Cell[] {
  const messages: Cell[] = [];
  for (let offset = 0; offset < packedCombinations.length; offset += V4_LIMITS.MAX_BALL_BATCH) {
    const chunk = packedCombinations.slice(offset, offset + V4_LIMITS.MAX_BALL_BATCH);
    messages.push(buildBallBatchMessage(chunk, uniqueQueryId(baseQueryId, messages.length)));
  }
  return messages;
}

/**
 * 100K V4 `BuyTicketBatch (0x1011)` — ONE message that mints ONE
 * `Ticket100kPack` for `count` contiguous numbers.
 *
 * TL-B (shared/wrappers/100k `storeBuyTicketBatch`):
 *   opcode:uint32 = 0x1011, queryId:uint64, count:uint8
 */
export function buildHundredKPackMessage(count: number, queryId: bigint = nextQueryId()): Cell {
  const safeCount = Math.min(Math.max(Math.trunc(count), 1), V4_LIMITS.MAX_PACK_SIZE);
  return beginCell()
    .storeUint(OPCODES.BuyTicketBatch, 32)
    .storeUint(queryId, 64)
    .storeUint(safeCount, 8)
    .endCell();
}

/** 100K pack `Claim (0x3011)` / `Refund (0x3012)` — opcode only. */
export function buildPackAction(action: 'claim' | 'refund'): Cell {
  return buildHundredKTicketAction(action);
}

/** BALL ticket `Claim` (0x3008) / `Refund` (0x3009): queryId:uint64. */
export function buildBallTicketAction(action: 'claim' | 'refund', queryId: bigint = nextQueryId()): Cell {
  return beginCell()
    .storeUint(action === 'claim' ? OPCODES.BallClaim : OPCODES.BallRefund, 32)
    .storeUint(queryId, 64)
    .endCell();
}

/** 100K ticket `Claim` (0x3011) / `Refund` (0x3012): opcode only. */
export function buildHundredKTicketAction(action: 'claim' | 'refund'): Cell {
  return beginCell().storeUint(action === 'claim' ? OPCODES.HundredKClaim : OPCODES.HundredKRefund, 32).endCell();
}

export function buildClaim(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  return gameType === 'BALL' ? buildBallTicketAction('claim', queryId) : buildHundredKTicketAction('claim');
}

export function buildRefund(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  return gameType === 'BALL' ? buildBallTicketAction('refund', queryId) : buildHundredKTicketAction('refund');
}

export function buildForceStartGame(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  const builder = beginCell().storeUint(OPCODES.ForceStartGame, 32);
  if (gameType === 'BALL') builder.storeUint(queryId, 64);
  return builder.endCell();
}

export function buildCheckDeadline(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  const builder = beginCell().storeUint(OPCODES.CheckDeadline, 32);
  if (gameType === 'BALL') builder.storeUint(queryId, 64);
  return builder.endCell();
}

export function buildCheckVrfTimeout(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  const builder = beginCell().storeUint(OPCODES.CheckVrfTimeout, 32);
  if (gameType === 'BALL') builder.storeUint(queryId, 64);
  return builder.endCell();
}

export function buildCloseExpiredDraw(gameType: GameType, queryId: bigint = nextQueryId()): Cell {
  const builder = beginCell().storeUint(OPCODES.CloseExpiredDraw, 32);
  if (gameType === 'BALL') builder.storeUint(queryId, 64);
  return builder.endCell();
}

export function buildRetryRollover(queryId: bigint = nextQueryId()): Cell {
  return beginCell().storeUint(OPCODES.RetryRollover, 32).storeUint(queryId, 64).endCell();
}

/**
 * BALL `SweepCompanyFee` (0x2005): queryId:uint64, amount:coins.
 * The contract clamps the amount to the accrued fee above its reserve.
 */
export function buildBallSweepCompanyFee(amountNano: bigint, queryId: bigint = nextQueryId()): Cell {
  return beginCell()
    .storeUint(OPCODES.SweepCompanyFee, 32)
    .storeUint(queryId, 64)
    .storeCoins(amountNano)
    .endCell();
}

/** 100K `SweepCompanyFee` (0x2005): no fields. */
export function buildHundredKSweepCompanyFee(): Cell {
  return beginCell().storeUint(OPCODES.SweepCompanyFee, 32).endCell();
}

/** BALL factory `DeployDraw` (0x4001): queryId:uint64, roundId:uint32. */
export function buildBallDeployDraw(roundId: number, queryId: bigint = nextQueryId()): Cell {
  return beginCell()
    .storeUint(OPCODES.BallDeployDraw, 32)
    .storeUint(queryId, 64)
    .storeUint(roundId, 32)
    .endCell();
}

/** 100K factory `CreateDraw` (0x2007): queryId:uint64. */
export function buildHundredKCreateDraw(queryId: bigint = nextQueryId()): Cell {
  return beginCell().storeUint(OPCODES.HundredKCreateDraw, 32).storeUint(queryId, 64).endCell();
}

export function toPayloadBase64(cell: Cell): string {
  return cell.toBoc().toString('base64');
}
