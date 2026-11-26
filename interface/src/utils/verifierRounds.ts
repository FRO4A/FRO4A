import { DRAW_STATUS } from '../types/game';

/** One selectable round in the fairness verifier. */
export interface VerifierRoundOption {
  roundId: number;
  /** Known on-chain status, or `null` when the round is synthesized from the active draw. */
  status: number | null;
  /** `null` when the API has not indexed a result for this round yet. */
  winnerCount: number | null;
}

export interface VerifierRoundSource {
  roundId: number;
  status: number | null;
  winnerCount?: number | null;
}

/**
 * Build the complete selectable round list for the verifier.
 *
 * The public history endpoint only returns rounds whose sales already closed,
 * and it may legitimately omit a round that the current draw knows about. To
 * make `BALL` round #1 always selectable on the very first visit, the list is
 * synthesized as `[latestRoundId, latestRoundId - 1, ..., 1]` and every known
 * history/active record is merged in. A directly typed round id extends the
 * list up to that id as well.
 */
export function buildVerifierRounds({
  history = [],
  active = null,
  latestRoundId = 0,
  selectedRoundId = null,
}: {
  history?: readonly VerifierRoundSource[];
  active?: VerifierRoundSource | null;
  latestRoundId?: number;
  selectedRoundId?: number | null;
}): VerifierRoundOption[] {
  const known = new Map<number, VerifierRoundOption>();

  const remember = (source: VerifierRoundSource): void => {
    if (!Number.isFinite(source.roundId) || source.roundId < 1) return;
    const roundId = Math.trunc(source.roundId);
    const existing = known.get(roundId);
    // Prefer a record that carries an actual status over a synthesized one.
    if (existing !== undefined && existing.status !== null && source.status === null) return;
    known.set(roundId, {
      roundId,
      status: source.status ?? null,
      winnerCount: source.winnerCount ?? existing?.winnerCount ?? null,
    });
  };

  for (const item of history) remember(item);
  if (active !== null) remember(active);

  const highestKnown = [...known.keys()].reduce((max, roundId) => Math.max(max, roundId), 0);
  const selected = selectedRoundId !== null && Number.isFinite(selectedRoundId) ? Math.trunc(selectedRoundId) : 0;
  const highest = Math.max(
    1,
    Math.trunc(latestRoundId) || 0,
    highestKnown,
    selected,
  );

  const rounds: VerifierRoundOption[] = [];
  for (let roundId = highest; roundId >= 1; roundId -= 1) {
    rounds.push(known.get(roundId) ?? { roundId, status: null, winnerCount: null });
  }
  return rounds;
}

/** Every closed round (SALES_CLOSED / TALLYING / CLAIM_OPEN / CANCELLED) is verifiable. */
export function isVerifiableRoundStatus(status: number | null): boolean {
  return status !== null && status >= DRAW_STATUS.SALES_CLOSED;
}

/**
 * Default round selection:
 * - the most recent closed round below the active round (Round #1 while #2 runs),
 * - otherwise the newest closed round,
 * - otherwise the previous round (`latestRoundId - 1`) or Round #1.
 */
export function pickDefaultVerifierRound(
  rounds: readonly VerifierRoundOption[],
  latestRoundId: number,
): number | null {
  if (rounds.length === 0) return null;
  const finished = rounds
    .filter((round) => isVerifiableRoundStatus(round.status))
    .sort((left, right) => left.roundId - right.roundId);

  // The newest round itself may already be verifiable (no newer active round yet).
  const newest = rounds.find((round) => round.roundId === latestRoundId) ?? null;
  if (newest !== null && isVerifiableRoundStatus(newest.status)) return newest.roundId;

  if (finished.length > 0) {
    const belowActive =
      latestRoundId > 1
        ? [...finished].reverse().find((round) => round.roundId < latestRoundId)
        : undefined;
    return (belowActive ?? finished[finished.length - 1]).roundId;
  }

  const highest = Math.trunc(latestRoundId) || rounds[0].roundId;
  return highest > 1 ? highest - 1 : rounds[rounds.length - 1].roundId;
}

/** Highest round id known from any source (0 when nothing is known yet). */
export function latestKnownRoundId(sources: readonly (VerifierRoundSource | null | undefined)[]): number {
  return sources.reduce((max, source) => {
    if (source === null || source === undefined) return max;
    return Number.isFinite(source.roundId) ? Math.max(max, Math.trunc(source.roundId)) : max;
  }, 0);
}
