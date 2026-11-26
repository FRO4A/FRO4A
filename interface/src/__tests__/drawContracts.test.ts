import { describe, expect, it } from 'vitest';
import { buildDrawContractRows, type LiveGameSnapshot } from '../utils/drawContracts';

const MANIFEST = {
  ballDrawRound1: 'EQ_BALL_ROUND_1_MANIFEST',
  draw100kRound1: 'EQ_100K_ROUND_1_MANIFEST',
};

const LIVE_ROUND_2: LiveGameSnapshot[] = [
  {
    game: 'ball',
    gameType: 'BALL',
    current: { roundId: 2, drawAddress: 'EQ_BALL_ROUND_2_LIVE' },
  },
  {
    game: '100k',
    gameType: '100K',
    current: { roundId: 2, drawAddress: 'EQ_100K_ROUND_2_LIVE' },
  },
];

describe('buildDrawContractRows', () => {
  it('uses the live round number and current draw address for every active game', () => {
    const rows = buildDrawContractRows(LIVE_ROUND_2, MANIFEST);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      gameType: 'BALL',
      roundId: 2,
      drawAddress: 'EQ_BALL_ROUND_2_LIVE',
      source: 'live',
    });
    expect(rows[1]).toMatchObject({
      gameType: '100K',
      roundId: 2,
      drawAddress: 'EQ_100K_ROUND_2_LIVE',
      source: 'live',
    });
    expect(rows.map((row) => row.drawAddress)).not.toContain(MANIFEST.ballDrawRound1);
  });

  it('renders future rounds and brand-new games without hardcoded entries', () => {
    const rows = buildDrawContractRows(
      [
        { game: 'ball', gameType: 'BALL', current: { roundId: 3, drawAddress: 'EQ_BALL_ROUND_3' } },
        { game: '100k', gameType: '100K', current: { roundId: 4, drawAddress: 'EQ_100K_ROUND_4' } },
        { game: '500k', gameType: '500K', current: { roundId: 1, address: 'EQ_500K_ROUND_1' } },
      ],
      MANIFEST,
    );

    expect(rows.map((row) => `${row.gameType}#${row.roundId}`)).toEqual([
      'BALL#3',
      '100K#4',
      '500K#1',
    ]);
    expect(rows[2].drawAddress).toBe('EQ_500K_ROUND_1');
  });

  it('falls back to the manifest only while no live draw data is available', () => {
    expect(buildDrawContractRows(undefined, MANIFEST)).toEqual([
      {
        key: 'manifest-ball-round-1',
        gameType: 'BALL',
        roundId: 1,
        drawAddress: MANIFEST.ballDrawRound1,
        source: 'manifest',
      },
      {
        key: 'manifest-100k-round-1',
        gameType: '100K',
        roundId: 1,
        drawAddress: MANIFEST.draw100kRound1,
        source: 'manifest',
      },
    ]);
    expect(buildDrawContractRows([], MANIFEST)).toHaveLength(2);
    expect(
      buildDrawContractRows(
        [{ game: 'ball', gameType: 'BALL', current: null }],
        MANIFEST,
      ).every((row) => row.source === 'manifest'),
    ).toBe(true);
  });

  it('ignores malformed live entries instead of rendering an empty contract row', () => {
    const rows = buildDrawContractRows(
      [
        { game: 'ball', gameType: 'BALL', current: { roundId: 0, drawAddress: 'EQ_BALL_ZERO' } },
        { game: '100k', gameType: '100K', current: { roundId: 2, drawAddress: '   ' } },
      ],
      MANIFEST,
    );

    expect(rows.map((row) => row.source)).toEqual(['manifest', 'manifest']);
  });

  it('returns only live rows when at least one live draw exists', () => {
    const rows = buildDrawContractRows(
      [
        { game: 'ball', gameType: 'BALL', current: { roundId: 2, drawAddress: 'EQ_BALL_ROUND_2' } },
        { game: '100k', gameType: '100K', current: null },
      ],
      MANIFEST,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('live');
    expect(rows[0].gameType).toBe('BALL');
  });

  it('changes the React key whenever the round contract changes', () => {
    const round2 = buildDrawContractRows(LIVE_ROUND_2, MANIFEST)[0];
    const round3 = buildDrawContractRows(
      [
        {
          game: 'ball',
          gameType: 'BALL',
          current: { roundId: 3, drawAddress: 'EQ_BALL_ROUND_3' },
        },
      ],
      MANIFEST,
    )[0];
    expect(round2.key).not.toBe(round3.key);
  });
});
