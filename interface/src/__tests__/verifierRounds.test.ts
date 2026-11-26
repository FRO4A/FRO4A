import { describe, expect, it } from 'vitest';
import {
  buildVerifierRounds,
  isVerifiableRoundStatus,
  latestKnownRoundId,
  pickDefaultVerifierRound,
} from '../utils/verifierRounds';
import { DRAW_STATUS } from '../types/game';

describe('verifier round list', () => {
  it('synthesizes round #1 when the BALL history response is empty', () => {
    const rounds = buildVerifierRounds({
      history: [],
      active: { roundId: 2, status: DRAW_STATUS.ACTIVE_SALES },
      latestRoundId: 2,
    });
    expect(rounds.map((round) => round.roundId)).toEqual([2, 1]);
    expect(rounds[0]).toMatchObject({ roundId: 2, status: DRAW_STATUS.ACTIVE_SALES });
    expect(rounds[1]).toMatchObject({ roundId: 1, status: null, winnerCount: null });
  });

  it('keeps the finished round #1 selectable while round #2 is active', () => {
    const rounds = buildVerifierRounds({
      history: [{ roundId: 1, status: DRAW_STATUS.CLAIM_OPEN, winnerCount: 3 }],
      active: { roundId: 2, status: DRAW_STATUS.ACTIVE_SALES },
      latestRoundId: 2,
    });
    expect(rounds.map((round) => round.roundId)).toEqual([2, 1]);
    expect(rounds[1]).toMatchObject({ roundId: 1, status: DRAW_STATUS.CLAIM_OPEN, winnerCount: 3 });
  });

  it('extends the list up to a directly typed round id', () => {
    const rounds = buildVerifierRounds({
      history: [{ roundId: 1, status: DRAW_STATUS.CLAIM_OPEN }],
      latestRoundId: 2,
      selectedRoundId: 5,
    });
    expect(rounds.map((round) => round.roundId)).toEqual([5, 4, 3, 2, 1]);
  });

  it('ignores malformed round ids', () => {
    const rounds = buildVerifierRounds({
      history: [
        { roundId: 0, status: DRAW_STATUS.CLAIM_OPEN },
        { roundId: -3, status: DRAW_STATUS.CLAIM_OPEN },
        { roundId: Number.NaN, status: DRAW_STATUS.CLAIM_OPEN },
      ],
      latestRoundId: 1,
    });
    expect(rounds.map((round) => round.roundId)).toEqual([1]);
  });
});

describe('verifier default round selection', () => {
  it('selects Round #1 while Round #2 is active', () => {
    const rounds = buildVerifierRounds({
      history: [{ roundId: 1, status: DRAW_STATUS.CLAIM_OPEN }],
      active: { roundId: 2, status: DRAW_STATUS.ACTIVE_SALES },
      latestRoundId: 2,
    });
    expect(pickDefaultVerifierRound(rounds, 2)).toBe(1);
  });

  it('selects Round #1 for a single finished round', () => {
    const rounds = buildVerifierRounds({
      history: [{ roundId: 1, status: DRAW_STATUS.CLAIM_OPEN }],
      latestRoundId: 1,
    });
    expect(pickDefaultVerifierRound(rounds, 1)).toBe(1);
  });

  it('selects the newest round when that round is already verifiable', () => {
    const rounds = buildVerifierRounds({
      history: [
        { roundId: 2, status: DRAW_STATUS.CLAIM_OPEN },
        { roundId: 1, status: DRAW_STATUS.CLAIM_OPEN },
      ],
      latestRoundId: 2,
    });
    expect(pickDefaultVerifierRound(rounds, 2)).toBe(2);
  });

  it('selects the newest finished round below the active round', () => {
    const rounds = buildVerifierRounds({
      history: [
        { roundId: 2, status: DRAW_STATUS.CLAIM_OPEN },
        { roundId: 1, status: DRAW_STATUS.CANCELLED },
      ],
      active: { roundId: 3, status: DRAW_STATUS.ACTIVE_SALES },
      latestRoundId: 3,
    });
    expect(pickDefaultVerifierRound(rounds, 3)).toBe(2);
  });

  it('falls back to the previous round when nothing is finished yet', () => {
    const rounds = buildVerifierRounds({
      active: { roundId: 2, status: DRAW_STATUS.ACTIVE_SALES },
      latestRoundId: 2,
    });
    expect(pickDefaultVerifierRound(rounds, 2)).toBe(1);
  });

  it('returns null only when the list is empty', () => {
    expect(pickDefaultVerifierRound([], 0)).toBeNull();
  });
});

describe('verifier round helpers', () => {
  it('treats every closed status as verifiable', () => {
    expect(isVerifiableRoundStatus(DRAW_STATUS.SALES_CLOSED)).toBe(true);
    expect(isVerifiableRoundStatus(DRAW_STATUS.TALLYING)).toBe(true);
    expect(isVerifiableRoundStatus(DRAW_STATUS.CLAIM_OPEN)).toBe(true);
    expect(isVerifiableRoundStatus(DRAW_STATUS.CANCELLED)).toBe(true);
    expect(isVerifiableRoundStatus(DRAW_STATUS.ACTIVE_SALES)).toBe(false);
    expect(isVerifiableRoundStatus(DRAW_STATUS.WAITING_FIRST_TICKET)).toBe(false);
    expect(isVerifiableRoundStatus(null)).toBe(false);
  });

  it('derives the latest round id from the active draw and history', () => {
    expect(
      latestKnownRoundId([
        { roundId: 2, status: DRAW_STATUS.ACTIVE_SALES },
        { roundId: 1, status: DRAW_STATUS.CLAIM_OPEN },
        null,
        undefined,
      ]),
    ).toBe(2);
    expect(latestKnownRoundId([null, undefined])).toBe(0);
  });
});
