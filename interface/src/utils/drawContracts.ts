import type { Deployments } from '../types/deployments';

/**
 * Minimal shape of one game entry from `GET /api/overview`.
 *
 * `gameType` is deliberately a plain string (not the `BALL | 100K` union) so a
 * brand-new game returned by the live API is rendered automatically, without a
 * hardcoded frontend list. `drawAddress` / `address` are both accepted because
 * the API exposes the draw contract under either name depending on the
 * snapshot (`/api/overview` vs. `/api/games/:game/current`).
 */
export interface LiveGameSnapshot {
  game?: string;
  gameType: string;
  current: {
    roundId: number;
    drawAddress?: string | null;
    address?: string | null;
  } | null;
}

export type DrawContractSource = 'live' | 'manifest';

/** One draw-contract row of the `Verified contracts` card. */
export interface DrawContractRow {
  /** Stable React key that changes whenever the round/address changes. */
  key: string;
  gameType: string;
  roundId: number;
  drawAddress: string;
  /** `live` when taken from the API, `manifest` while the API has not loaded. */
  source: DrawContractSource;
}

function liveAddress(current: LiveGameSnapshot['current']): string | null {
  if (current === null) return null;
  const address = (current.drawAddress ?? current.address ?? '').trim();
  if (address.length === 0) return null;
  if (!Number.isFinite(current.roundId) || current.roundId < 1) return null;
  return address;
}

/**
 * Live-first rows for the `Проверенные контракты / Verified contracts` card.
 *
 * - Every game present in the live API snapshot contributes its CURRENT draw
 *   contract and live round number (Round #2, #3, … and any future game).
 * - The static manifest (Round 1 addresses) is used only while no live draw
 *   data is available, so the card is never empty during the first request.
 */
export function buildDrawContractRows(
  games: readonly LiveGameSnapshot[] | null | undefined,
  deployments: Pick<Deployments, 'ballDrawRound1' | 'draw100kRound1'>,
): DrawContractRow[] {
  const live: DrawContractRow[] = [];
  for (const entry of games ?? []) {
    const current = entry.current;
    const address = liveAddress(current);
    if (current === null || address === null) continue;
    live.push({
      key: `live-${entry.game ?? entry.gameType}-${current.roundId}-${address}`,
      gameType: entry.gameType,
      roundId: current.roundId,
      drawAddress: address,
      source: 'live',
    });
  }
  if (live.length > 0) return live;

  return [
    {
      key: 'manifest-ball-round-1',
      gameType: 'BALL',
      roundId: 1,
      drawAddress: deployments.ballDrawRound1,
      source: 'manifest',
    },
    {
      key: 'manifest-100k-round-1',
      gameType: '100K',
      roundId: 1,
      drawAddress: deployments.draw100kRound1,
      source: 'manifest',
    },
  ];
}
