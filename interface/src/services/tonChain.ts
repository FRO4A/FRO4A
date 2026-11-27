import type {
  ChainDrawView,
  ChainPackView,
  ChainTicketView,
  CurrentDrawView,
  DrawBaseView,
  HistoryDrawView,
  HistoryResponse,
  OverviewResponse,
} from '../types/api';
import type { GameType, KnownDraw, OnChainTicket, TicketView } from '../types/game';
import { hundredKWinnerPlace, computeTicketResult, matchedBalls } from '../utils/ticket';
import { sameAddress } from '../utils/address';
import {
  decodeBallCombination,
  formatBallCombination,
  pad6,
  parseTonToNano,
  toBigInt,
} from '../utils/format';
import { fetchCurrentDraw, fetchHistory, fetchOverview } from './api';
import {
  readSnakeString,
  runGetter,
  stackAddress,
  stackCell,
  stackNumber,
} from './tonapi';
import {
  discoverBallTicketsFromWallet,
  discoverTicketsFromQuotaShards,
  discoverTicketsFromTraces,
  mergeTicketCandidates,
  type TicketCandidate,
} from './ticketDiscovery';

export interface DrawOnChainState {
  status: number | null;
  totalTicketsSold: number | null;
  deadlineTimestamp: number | null;
  expiryTimestamp: number | null;
  targetVrfTime: number | null;
  roundId: number | null;
}

function fromBase(base: DrawBaseView, extra: Partial<KnownDraw> = {}): KnownDraw {
  return {
    gameType: base.gameType,
    roundId: base.roundId,
    drawAddress: base.drawAddress,
    status: base.status,
    expiryTimestamp: base.expiryTimestamp,
    deadlineTimestamp: base.deadlineTimestamp,
    tallyDeadline: base.tallyDeadline ?? null,
    claimDeadline: base.claimDeadline ?? base.expiryTimestamp ?? null,
    totalTicketsSold: base.totalTicketsSold,
    ticketPriceTon: base.ticketPrice?.ton ?? null,
    refundTon: base.refundValue?.ton ?? null,
    winningNumbers: null,
    winningTickets: null,
    categories: [],
    winnerCount: base.winnerCount ?? 0,
    rolloverInTon: base.rolloverIn?.ton ?? null,
    rolloverOutTon: base.rolloverOut?.ton ?? null,
    tonviewerUrl: base.tonviewerUrl,
    ...extra,
  };
}

export function knownDrawFromCurrent(draw: CurrentDrawView): KnownDraw {
  return fromBase(draw, {
    winningNumbers: draw.winningNumbers ? { whites: draw.winningNumbers.whites, red: draw.winningNumbers.red } : null,
    winningTickets: draw.winningTickets?.tickets ?? null,
    categories: draw.categories,
  });
}

export function knownDrawFromHistory(draw: HistoryDrawView): KnownDraw {
  return fromBase(draw, {
    winningNumbers: draw.winningNumbers ? { whites: draw.winningNumbers.whites, red: draw.winningNumbers.red } : null,
    winningTickets: draw.winningTickets?.tickets ?? null,
    categories: draw.categories,
  });
}

/** KnownDraw from the fast `/api/chain/tickets` payload (already authenticated). */
export function knownDrawFromChain(draw: ChainDrawView): KnownDraw {
  return fromBase(draw, {
    winningNumbers: draw.winningNumbers ? { whites: draw.winningNumbers.whites, red: draw.winningNumbers.red } : null,
    winningTickets: draw.winningTickets,
    categories: draw.categories,
  });
}

/**
 * Maps one server mirror ticket to the existing UI ticket shape. This keeps
 * `TicketCard`, filters and claim/refund actions unchanged while My Tickets is
 * loaded in ~20ms from PostgreSQL instead of scanning the chain in the browser.
 */
export function ticketViewFromChain(
  ticket: ChainTicketView,
  draws: Record<string, ChainDrawView>,
): TicketView {
  const chainDraw = draws[ticket.drawAddress] ?? null;
  const draw = chainDraw ? knownDrawFromChain(chainDraw) : null;
  const ticketNumber = ticket.ticketNumber;
  let category = ticket.category;
  let place = ticket.place;
  let payoutNano = ticket.payout?.nanotons ?? null;

  if (ticket.gameType === '100K' && draw?.winningTickets && ticketNumber !== null) {
    const derivedPlace = hundredKWinnerPlace(draw.winningTickets, ticketNumber);
    if (derivedPlace !== null) {
      category = category ?? derivedPlace;
      place = place ?? derivedPlace;
      const budget = draw.categories.find((item) => item.category === derivedPlace);
      payoutNano = payoutNano ?? budget?.payoutPerTicket.nanotons ?? null;
    }
  }

  return {
    gameType: ticket.gameType,
    ticketAddress: ticket.ticketAddress,
    drawAddress: ticket.drawAddress,
    roundId: ticket.roundId,
    owner: ticket.owner ?? ticket.ownerAddress ?? null,
    ticketKey: ticket.ticketKey,
    packedCombination: ticket.packedCombination ?? null,
    displayValue: ticket.displayValue,
    whites: ticket.whites ?? ticket.whiteBalls ?? null,
    red: ticket.red ?? ticket.redBall ?? null,
    status: ticket.status,
    category,
    place,
    payoutNano,
    name: ticket.gameType === '100K' ? ticket.displayValue : null,
    result: ticket.result,
    drawStatus: ticket.drawStatus ?? chainDraw?.status ?? null,
    tier: ticket.tier ?? category,
    tallied: ticket.tallied ?? false,
    claimed: ticket.claimed ?? ticket.status === 3,
    matchedWhites: ticket.matchedWhites,
    redMatched: ticket.redMatched,
    draw,
    isWinner: ticket.isWinner || (category !== null && category > 0),
  };
}

/**
 * Maps ONE 100K V4 `Ticket100kPack` to the existing UI ticket shape.
 *
 * A pack is a single on-chain contract for `count` contiguous numbers, so it
 * becomes ONE row in My Tickets with every individual number kept in `pack`.
 */
export function packViewFromChain(
  pack: ChainPackView,
  draws: Record<string, ChainDrawView>,
): TicketView {
  const chainDraw = draws[pack.drawAddress] ?? null;
  const draw = chainDraw ? knownDrawFromChain(chainDraw) : null;
  const places = pack.tickets
    .map((ticket) => ticket.place)
    .filter((place): place is number => place !== null && place > 0);
  const bestPlace = places.length > 0 ? Math.min(...places) : null;
  const totalPrizeNano = pack.totalPrizeTon === null ? null : (parseTonToNano(pack.totalPrizeTon)?.toString() ?? null);

  return {
    gameType: '100K',
    ticketAddress: pack.packAddress,
    drawAddress: pack.drawAddress,
    roundId: pack.roundId,
    ticketKey: String(pack.startNumber),
    displayValue: pack.displayValue,
    whites: null,
    red: null,
    status: pack.status,
    category: bestPlace,
    place: bestPlace,
    payoutNano: totalPrizeNano,
    name: pack.displayValue,
    result: pack.result,
    drawStatus: pack.drawStatus ?? chainDraw?.status ?? null,
    tier: bestPlace,
    tallied: false,
    claimed: pack.status === 3,
    matchedWhites: undefined,
    redMatched: undefined,
    pack: {
      packAddress: pack.packAddress,
      startNumber: pack.startNumber,
      count: pack.count,
      displayValue: pack.displayValue,
      tickets: pack.tickets,
      totalPrizeTon: pack.totalPrizeTon,
      claimDeadline: pack.claimDeadline,
    },
    draw,
    isWinner: pack.isWinner,
  };
}

function mergeDraw(target: KnownDraw[], candidate: KnownDraw): void {
  const index = target.findIndex((draw) => sameAddress(draw.drawAddress, candidate.drawAddress));
  if (index === -1) target.push(candidate);
  else target[index] = { ...target[index], ...candidate };
}

/**
 * Public draw registry for client-side ticket discovery. It merges
 * `/api/overview`, both `current` endpoints, both history pages and the
 * deployment manifest — exactly the sources required by SPEC §7.
 *
 * The registry contains only public on-chain data: no wallet is ever sent.
 */
export async function loadKnownDraws(
  deployments: { ballDrawRound1: string; draw100kRound1: string },
  signal?: AbortSignal,
): Promise<KnownDraw[]> {
  const draws: KnownDraw[] = [];
  const overview = await fetchOverview(signal).catch(() => null as OverviewResponse | null);
  if (overview) {
    for (const game of overview.games) {
      if (game.current) mergeDraw(draws, fromBase(game.current));
    }
  }

  const [ballCurrent, hundredCurrent, ballHistory, hundredHistory] = await Promise.allSettled([
    fetchCurrentDraw('ball', signal),
    fetchCurrentDraw('100k', signal),
    fetchHistory('ball', 100, 1, signal),
    fetchHistory('100k', 100, 1, signal),
  ]);

  if (ballCurrent.status === 'fulfilled') mergeDraw(draws, knownDrawFromCurrent(ballCurrent.value));
  if (hundredCurrent.status === 'fulfilled') mergeDraw(draws, knownDrawFromCurrent(hundredCurrent.value));
  for (const result of [ballHistory, hundredHistory]) {
    if (result.status !== 'fulfilled') continue;
    const page = result.value as HistoryResponse;
    for (const item of page.items) mergeDraw(draws, knownDrawFromHistory(item));
  }

  if (
    deployments.ballDrawRound1.trim().length > 0 &&
    !draws.some((draw) => sameAddress(draw.drawAddress, deployments.ballDrawRound1))
  ) {
    draws.push({
      gameType: 'BALL',
      roundId: 1,
      drawAddress: deployments.ballDrawRound1,
      status: null,
      expiryTimestamp: null,
      deadlineTimestamp: null,
      totalTicketsSold: 0,
      ticketPriceTon: null,
      refundTon: null,
      winningNumbers: null,
      winningTickets: null,
      categories: [],
      tonviewerUrl: null,
    });
  }
  if (
    deployments.draw100kRound1.trim().length > 0 &&
    !draws.some((draw) => sameAddress(draw.drawAddress, deployments.draw100kRound1))
  ) {
    draws.push({
      gameType: '100K',
      roundId: 1,
      drawAddress: deployments.draw100kRound1,
      status: null,
      expiryTimestamp: null,
      deadlineTimestamp: null,
      totalTicketsSold: 0,
      ticketPriceTon: null,
      refundTon: null,
      winningNumbers: null,
      winningTickets: null,
      categories: [],
      tonviewerUrl: null,
    });
  }

  // Enrich deployment-only / not-yet-indexed draws directly from the chain so
  // My Tickets can still enable Claim/Refund when the API has no history item.
  await Promise.all(
    draws
      .filter((draw) => draw.status === null)
      .map(async (draw) => {
        try {
          const state = await readDrawState(draw.gameType, draw.drawAddress, signal);
          if (state.status !== null) draw.status = state.status;
          if (state.roundId !== null) draw.roundId = state.roundId;
          if (state.totalTicketsSold !== null) draw.totalTicketsSold = state.totalTicketsSold;
          if (state.deadlineTimestamp !== null) draw.deadlineTimestamp = new Date(state.deadlineTimestamp * 1000).toISOString();
          if (state.expiryTimestamp !== null) draw.expiryTimestamp = new Date(state.expiryTimestamp * 1000).toISOString();
        } catch {
          // destroyed or unreachable draw: keep the public API data
        }
      }),
  );

  return draws.sort((a, b) => (a.gameType === b.gameType ? b.roundId - a.roundId : a.gameType.localeCompare(b.gameType)));
}

function findKnownDraw(draws: KnownDraw[], address: string): KnownDraw | null {
  return draws.find((draw) => sameAddress(draw.drawAddress, address)) ?? null;
}

/**
 * V5 `BallTicket.getTicketData()` — flattened tuple:
 *   [drawAddress, roundId, owner, packedCombination, white1..white5, red, tallied, claimed]
 */
function parseBallTicketV5(
  ticketAddress: string,
  stack: import('./tonapi').TonApiStackItem[],
): OnChainTicket | null {
  const drawAddress = stackAddress(stack[0]);
  const roundId = Number(stackNumber(stack[1]) ?? 0n);
  const owner = stackAddress(stack[2]);
  const packed = stackNumber(stack[3]);
  if (!drawAddress || packed === null) return null;
  const whites = [4, 5, 6, 7, 8].map((index) => Number(stackNumber(stack[index]) ?? 0n));
  const red = Number(stackNumber(stack[9]) ?? 0n);
  const tallied = (stackNumber(stack[10]) ?? 0n) !== 0n;
  const claimed = (stackNumber(stack[11]) ?? 0n) !== 0n;
  const decoded = whites.every((white) => white >= 1) ? { whites, red } : decodeBallCombination(packed);
  return {
    gameType: 'BALL',
    ticketAddress,
    drawAddress: drawAddress.toString(),
    roundId,
    owner: owner === null ? null : owner.toString(),
    ticketKey: packed.toString(),
    packedCombination: packed.toString(),
    displayValue: formatBallCombination(decoded.whites, decoded.red),
    whites: decoded.whites,
    red: decoded.red,
    status: claimed ? 3 : tallied ? 2 : 0,
    category: null,
    place: null,
    payoutNano: null,
    name: null,
    tallied,
    claimed,
  };
}

/** Legacy V4 BALL ticket `getTicketInfo()` reader (old Testnet rounds only). */
function parseBallTicketLegacy(
  ticketAddress: string,
  stack: import('./tonapi').TonApiStackItem[],
): OnChainTicket | null {
  const drawAddress = stackAddress(stack[0]);
  const packed = stackNumber(stack[2]);
  if (!drawAddress || packed === null) return null;
  const roundId = Number(stackNumber(stack[3]) ?? 0n);
  const status = Number(stackNumber(stack[4]) ?? 0n);
  const categoryValue = Number(stackNumber(stack[5]) ?? 0n);
  const whites = [6, 7, 8, 9, 10].map((index) => Number(stackNumber(stack[index]) ?? 0n));
  const red = Number(stackNumber(stack[11]) ?? 0n);
  const decoded = whites.every((white) => white >= 1) ? { whites, red } : decodeBallCombination(packed);
  return {
    gameType: 'BALL',
    ticketAddress,
    drawAddress: drawAddress.toString(),
    roundId,
    ticketKey: packed.toString(),
    packedCombination: packed.toString(),
    displayValue: formatBallCombination(decoded.whites, decoded.red),
    whites: decoded.whites,
    red: decoded.red,
    status,
    category: categoryValue > 0 ? categoryValue : null,
    place: null,
    payoutNano: null,
    name: null,
    tallied: status === 2 || status === 3,
    claimed: status === 3,
  };
}

function parseHundredKTicket(ticketAddress: string, stack: import('./tonapi').TonApiStackItem[]): OnChainTicket | null {
  const drawAddress = stackAddress(stack[4]);
  const ticketNumber = stackNumber(stack[0]);
  if (!drawAddress || ticketNumber === null) return null;
  const roundId = Number(stackNumber(stack[1]) ?? 0n);
  const status = Number(stackNumber(stack[2]) ?? 0n);
  const payout = stackNumber(stack[6]) ?? 0n;
  const placeValue = Number(stackNumber(stack[7]) ?? 0n);
  let name: string | null = null;
  const nameCell = stackCell(stack[5]);
  if (nameCell) {
    try {
      name = readSnakeString(nameCell);
    } catch {
      name = null;
    }
  }
  return {
    gameType: '100K',
    ticketAddress,
    drawAddress: drawAddress.toString(),
    roundId,
    ticketKey: ticketNumber.toString(),
    displayValue: `Ticket #${pad6(ticketNumber)}`,
    whites: null,
    red: null,
    status,
    category: placeValue > 0 ? placeValue : null,
    place: placeValue > 0 ? placeValue : null,
    payoutNano: payout > 0n ? payout.toString() : null,
    name,
  };
}

export async function readTicket(
  gameType: GameType,
  ticketAddress: string,
  expectedOwner?: string,
  signal?: AbortSignal,
): Promise<OnChainTicket> {
  let ticket: OnChainTicket | null = null;
  let owner: ReturnType<typeof stackAddress> = null;
  if (gameType === 'BALL') {
    // V5 `getTicketData()` first, legacy `getTicketInfo()` only for old rounds.
    try {
      const result = await runGetter(ticketAddress, 'getTicketData', signal);
      if (result.exitCode === 0) {
        owner = stackAddress(result.stack[2]);
        ticket = parseBallTicketV5(ticketAddress, result.stack);
      }
    } catch {
      ticket = null;
    }
    if (ticket === null) {
      const legacy = await runGetter(ticketAddress, 'getTicketInfo', signal);
      if (legacy.exitCode !== 0) throw new Error(`Ticket getter failed (${legacy.exitCode})`);
      owner = stackAddress(legacy.stack[1]);
      ticket = parseBallTicketLegacy(ticketAddress, legacy.stack);
    }
  } else {
    const result = await runGetter(ticketAddress, 'get_ticket_info', signal);
    if (result.exitCode !== 0) throw new Error(`Ticket getter failed (${result.exitCode})`);
    owner = stackAddress(result.stack[3]);
    ticket = parseHundredKTicket(ticketAddress, result.stack);
  }
  if (owner === null) throw new Error('Ticket is not minted');
  if (expectedOwner && !sameAddress(owner.toString(), expectedOwner)) {
    throw new Error('Ticket owner mismatch');
  }
  if (ticket === null) throw new Error('Malformed ticket getter response');
  return ticket;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const value = await worker(items[index]).catch(() => null);
      if (value !== null) results.push(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function readTicketWithRetry(
  gameType: GameType,
  ticketAddress: string,
  owner: string,
  signal?: AbortSignal,
): Promise<OnChainTicket> {
  try {
    return await readTicket(gameType, ticketAddress, owner, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return readTicket(gameType, ticketAddress, owner, signal);
  }
}

/**
 * Discovers the connected wallet's V5 tickets entirely in the browser.
 *
 * Two independent sources are merged:
 *   1. The wallet's own BuyTicket payloads -> deterministic BALL `BallTicket`
 *      addresses (no token index, no collection getters).
 *   2. Deterministic draw-history scan filtered by the wallet's quota shard.
 *
 * Wallet transaction traces remain a last-resort fallback when the draw history is
 * unreachable. Every candidate is finally verified with the live ticket getter,
 * including the owner check, so a duplicate mint attempt against somebody else's
 * ticket is rejected instead of being displayed.
 */
export async function discoverUserTickets(
  wallet: string,
  knownDraws: KnownDraw[],
  signal?: AbortSignal,
): Promise<TicketView[]> {
  const ballFromWallet = await discoverBallTicketsFromWallet(wallet, knownDraws, signal).catch(
    () => [] as TicketCandidate[],
  );

  // BALL is fully derivable from the wallet's own BuyTicket payloads. The draw
  // history scan is still needed for 100K (its ticket number is assigned on-chain)
  // and remains a fallback for BALL if the wallet payload path found nothing.
  const quotaDraws =
    ballFromWallet.length > 0 ? knownDraws.filter((draw) => draw.gameType === '100K') : knownDraws;
  const quotaCandidates = await discoverTicketsFromQuotaShards(wallet, quotaDraws, signal).catch(
    () => [] as TicketCandidate[],
  );

  let chainCandidates = mergeTicketCandidates([...ballFromWallet, ...quotaCandidates]);
  if (chainCandidates.length === 0 && knownDraws.length > 0) {
    chainCandidates = await discoverTicketsFromTraces(wallet, knownDraws, signal).catch(
      () => [] as TicketCandidate[],
    );
  }

  const candidates = mergeTicketCandidates(chainCandidates);
  const tickets = await mapWithConcurrency(candidates, 4, async (candidate) => {
    const draw = candidate.draw;
    const ticket = await readTicketWithRetry(draw.gameType, candidate.ticketAddress, wallet, signal);
    const resolvedDraw = findKnownDraw(knownDraws, ticket.drawAddress) ?? draw;
    let category = ticket.category;
    let place = ticket.place;
    let payoutNano = ticket.payoutNano;
    let isWinner = (ticket.category ?? 0) > 0;

    // 100K tickets learn their place only when the prize is paid. Before that,
    // derive the winner status from the public on-chain winning ticket list.
    if (ticket.gameType === '100K' && resolvedDraw.winningTickets) {
      const ticketNumber = Number(ticket.ticketKey);
      const derivedPlace = hundredKWinnerPlace(resolvedDraw.winningTickets, ticketNumber);
      if (derivedPlace !== null) {
        category = category ?? derivedPlace;
        place = place ?? derivedPlace;
        const budget = resolvedDraw.categories.find((item) => item.category === derivedPlace);
        payoutNano = payoutNano ?? budget?.payoutPerTicket.nanotons ?? null;
        isWinner = true;
      }
    }

    const matches = matchedBalls(ticket.whites, ticket.red, resolvedDraw.winningNumbers);
    return {
      ...ticket,
      category,
      place,
      payoutNano,
      tier: category,
      result: computeTicketResult(ticket.status, resolvedDraw.status, isWinner, resolvedDraw.expiryTimestamp),
      drawStatus: resolvedDraw.status,
      matchedWhites: matches.matchedWhites,
      redMatched: matches.redMatched,
      draw: resolvedDraw,
      isWinner,
    } as TicketView;
  });

  const unique: TicketView[] = [];
  for (const ticket of tickets) {
    if (!unique.some((candidate) => sameAddress(candidate.ticketAddress, ticket.ticketAddress))) unique.push(ticket);
  }
  // A partial read is still useful: unmatched candidates are simply skipped so a
  // single rate-limited getter can never blank out the whole list.
  return unique.sort((a, b) => b.roundId - a.roundId);
}

/** On-chain fallback when the API has not indexed a draw yet. */
export async function readDrawState(gameType: GameType, drawAddress: string, signal?: AbortSignal): Promise<DrawOnChainState> {
  const result = await runGetter(drawAddress, 'getDrawInfo', signal);
  if (result.exitCode !== 0) throw new Error(`Draw getter failed (${result.exitCode})`);
  const stack = result.stack;
  if (gameType === 'BALL') {
    return {
      roundId: Number(stackNumber(stack[0]) ?? 0n),
      status: Number(stackNumber(stack[1]) ?? 0n),
      totalTicketsSold: Number(stackNumber(stack[2]) ?? 0n),
      deadlineTimestamp: Number(stackNumber(stack[9]) ?? 0n) || null,
      targetVrfTime: Number(stackNumber(stack[10]) ?? 0n) || null,
      expiryTimestamp: Number(stackNumber(stack[13]) ?? 0n) || null,
    };
  }
  return {
    roundId: Number(stackNumber(stack[0]) ?? 0n),
    status: Number(stackNumber(stack[1]) ?? 0n),
    totalTicketsSold: Number(stackNumber(stack[2]) ?? 0n),
    deadlineTimestamp: Number(stackNumber(stack[12]) ?? 0n) || null,
    expiryTimestamp: Number(stackNumber(stack[13]) ?? 0n) || null,
    targetVrfTime: Number(stackNumber(stack[14]) ?? 0n) || null,
  };
}

/** Next sequential round from the immutable factory getter. */
export async function readFactoryNextRound(gameType: GameType, factoryAddress: string, signal?: AbortSignal): Promise<number> {
  const method = gameType === 'BALL' ? 'getFactoryConfig' : 'getFactoryInfo';
  const result = await runGetter(factoryAddress, method, signal);
  if (result.exitCode !== 0) throw new Error(`Factory getter failed (${result.exitCode})`);
  if (gameType === 'BALL') return Number(stackNumber(result.stack[3]) ?? 1n);
  const roundCounter = Number(stackNumber(result.stack[3]) ?? 0n);
  return roundCounter + 1;
}

export function ticketKeyBigInt(ticket: OnChainTicket): bigint {
  return toBigInt(ticket.ticketKey);
}


