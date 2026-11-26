import { Cell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { sameAddress } from '../utils/address';
import { userQuotaAddress } from '../services/quota';
import { ballTicketAddress } from '../services/ballTicketAddress';
import {
  decodeBallBuyPayload,
  matchNftCandidates,
  mergeTicketCandidates,
  parseBallBuyPayloads,
  parseBuyTicketCalls,
  parseMintDestinations,
  parseOpcode,
  parseTraceMintDestinations,
  type TicketCandidate,
} from '../services/ticketDiscovery';
import type { KnownDraw } from '../types/game';
import type { TonApiTransaction } from '../services/tonapi';

// LIVE TESTNET FIXTURES (22 Nov 2026): real buyer wallet 0:936b7e9c… bought
// BALL round 1 and 100K round 1. The quota shards below are the actual
// `in_msg.source` of the live `QuotaGranted` transactions, and the destinations
// are the SBT children that were really deployed on-chain.
const WALLET = '0:936b7e9cf0de368b569d2f6330942847e09390333fecdeb19eda9ddd85873e8b';
const BALL_DRAW = 'EQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pGjt';
const BALL_QUOTA = '0:d903aa8df90d33f6f2e8b5fc44d8d0b740cc1f7a0193f71c5faf9bc23bb5522e';
const BALL_TICKET = '0:bd74c202c416a81671c8fe93f181a1793544c22c62878d1504a21e0bbeaeda02';
const HUNDRED_DRAW = 'EQCOJWxFyH7TwBb8aABc8VettIUS24ARTz1L0JcNSbfrae8K';
const HUNDRED_QUOTA = '0:e659bbf8375b4b4a736e1e952d157a21b3b3f00054731b044c066a352f82d4a5';
const HUNDRED_TICKET = '0:8f19cfd393f0aa808e28eb7422207d70b478577c1c30c26267a73eebe5c3d48c';

function draw(gameType: 'BALL' | '100K', drawAddress: string): KnownDraw {
  return {
    gameType,
    roundId: 1,
    drawAddress,
    status: 1,
    expiryTimestamp: null,
    deadlineTimestamp: null,
    totalTicketsSold: 6,
    ticketPriceTon: null,
    refundTon: null,
    winningNumbers: null,
    winningTickets: null,
    categories: [],
    tonviewerUrl: null,
  };
}

const BALL_KNOWN = draw('BALL', BALL_DRAW);
const HUNDRED_KNOWN = draw('100K', HUNDRED_DRAW);

const LIVE_BALL_GRANT: TonApiTransaction = {
  hash: 'ball-grant',
  lt: '111492762000007',
  success: true,
  in_msg: { source: { address: BALL_QUOTA }, op_code: '0x00001003' },
  out_msgs: [{ destination: { address: BALL_TICKET }, op_code: '0x00001004' }],
};

const LIVE_HUNDRED_GRANT: TonApiTransaction = {
  hash: 'hundred-grant',
  lt: '111493638000007',
  success: true,
  in_msg: { source: { address: HUNDRED_QUOTA }, op_code: '0x00005101' },
  out_msgs: [{ destination: { address: HUNDRED_TICKET }, op_code: '0x00004001' }],
};

describe('opcode parsing', () => {
  it('accepts TonAPI hex opcodes and plain numbers', () => {
    expect(parseOpcode('0x00001001')).toBe(0x1001);
    expect(parseOpcode('0x00004001')).toBe(0x4001);
    expect(parseOpcode('4097')).toBe(4097);
    expect(parseOpcode(4100)).toBe(4100);
    expect(parseOpcode(null)).toBeNull();
    expect(parseOpcode('nope')).toBeNull();
  });
});

describe('deterministic quota shard (live proof)', () => {
  it('derives the exact on-chain BALL quota shard of the live buyer', () => {
    expect(sameAddress(userQuotaAddress('BALL', BALL_DRAW, WALLET), BALL_QUOTA)).toBe(true);
  });

  it('derives the exact on-chain 100K quota shard of the live buyer', () => {
    expect(sameAddress(userQuotaAddress('100K', HUNDRED_DRAW, WALLET), HUNDRED_QUOTA)).toBe(true);
  });
});

describe('client-side ticket discovery parser', () => {
  it('finds the real BALL SBT minted by the live quota shard', () => {
    const found = parseMintDestinations('BALL', [LIVE_BALL_GRANT], BALL_QUOTA);
    expect(found).toHaveLength(1);
    expect(sameAddress(found[0], BALL_TICKET)).toBe(true);
  });

  it('finds the real 100K SBT minted by the live quota shard', () => {
    const found = parseMintDestinations('100K', [LIVE_HUNDRED_GRANT], HUNDRED_QUOTA);
    expect(found).toHaveLength(1);
    expect(sameAddress(found[0], HUNDRED_TICKET)).toBe(true);
  });

  it('ignores transactions from other quota shards, other opcodes and the wrong game opcode', () => {
    const foreign = {
      ...LIVE_BALL_GRANT,
      in_msg: { source: { address: `0:${'1'.repeat(64)}` }, op_code: '0x00001003' },
    };
    expect(parseMintDestinations('BALL', [foreign], BALL_QUOTA)).toEqual([]);
    expect(parseMintDestinations('100K', [LIVE_BALL_GRANT], BALL_QUOTA)).toEqual([]);
    const otherOpcode = {
      ...LIVE_BALL_GRANT,
      out_msgs: [{ destination: { address: BALL_TICKET }, op_code: '0x00001005' }],
    };
    expect(parseMintDestinations('BALL', [otherOpcode], BALL_QUOTA)).toEqual([]);
  });

  it('deduplicates repeated mint messages for the same SBT', () => {
    const second = { ...LIVE_BALL_GRANT, hash: 'ball-grant-2', lt: '111492763000007' };
    const found = parseMintDestinations('BALL', [LIVE_BALL_GRANT, second], BALL_QUOTA);
    expect(found).toHaveLength(1);
  });

  it('walks nested traces as a fallback', () => {
    const trace = {
      transaction: {
        in_msg: { op_code: '0x7369676e' },
        out_msgs: [{ destination: { address: BALL_DRAW }, op_code: '0x00001001' }],
      },
      children: [
        {
          transaction: {
            in_msg: { source: { address: WALLET }, op_code: '0x00001001' },
            out_msgs: [{ destination: { address: BALL_QUOTA }, op_code: '0x00001002' }],
          },
          children: [
            {
              transaction: {
                in_msg: { source: { address: BALL_QUOTA }, op_code: '0x00001003' },
                out_msgs: [{ destination: { address: BALL_TICKET }, op_code: '0x00001004' }],
              },
            },
          ],
        },
      ],
    };
    expect(sameAddress(parseTraceMintDestinations('BALL', trace)[0], BALL_TICKET)).toBe(true);
  });

  it('identifies wallet BuyTicket calls that should be traced', () => {
    const walletTx: TonApiTransaction = {
      hash: 'wallet-buy',
      in_msg: { op_code: '0x7369676e' },
      out_msgs: [{ destination: { address: BALL_DRAW }, op_code: '0x00001001' }],
    };
    const calls = parseBuyTicketCalls([walletTx], [BALL_KNOWN, HUNDRED_KNOWN]);
    expect(calls).toHaveLength(1);
    expect(calls[0].hash).toBe('wallet-buy');
    expect(sameAddress(calls[0].draw.drawAddress, BALL_DRAW)).toBe(true);
  });

  it('matches NFT index entries only for known collections (any address encoding)', () => {
    const nfts = [
      {
        address: `0:${'a'.repeat(64)}`,
        collection: { address: 'UQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pDUo' },
      },
      { address: `0:${'b'.repeat(64)}`, collection: { address: `0:${'c'.repeat(64)}` } },
    ];
    const matched = matchNftCandidates(nfts, [BALL_KNOWN]);
    expect(matched).toHaveLength(1);
    expect(matched[0].source).toBe('nft');
  });

  it('merges candidates from several sources without duplicating an SBT', () => {
    const candidates: TicketCandidate[] = [
      { ticketAddress: BALL_TICKET, draw: BALL_KNOWN, source: 'nft' },
      { ticketAddress: BALL_TICKET, draw: BALL_KNOWN, source: 'quota-transactions' },
      { ticketAddress: HUNDRED_TICKET, draw: HUNDRED_KNOWN, source: 'trace' },
    ];
    const merged = mergeTicketCandidates(candidates);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('nft');
  });
});


describe('BALL fast path from the wallet BuyTicket payload (live proof)', () => {
  // Live `out_msgs[].raw_body` of the buyer's BALL purchase:
  // op 0x1001, queryId 0x1a204fe63b3, packedCombination 0xa4076d909d
  // (= 29-33-54-59-64 + Red 20, exactly what the live SBT getter reports).
  const LIVE_BALL_BUY_RAW = 'b5ee9c7201010101001600002800001001000001a204fe63b3000000a4076d909d';
  const LIVE_PACKED = BigInt('0xa4076d909d');
  const LIVE_100K_BUY_RAW = 'b5ee9c7201010101000e00001800001001000001a205039a3b';

  it('decodes the exact packed combination from the real message body', () => {
    const cell = Cell.fromBoc(Buffer.from(LIVE_BALL_BUY_RAW, 'hex'))[0];
    expect(decodeBallBuyPayload(cell)).toBe(LIVE_PACKED);
  });

  it('derives the exact live Testnet SBT address locally, with no RPC call', () => {
    expect(sameAddress(ballTicketAddress(BALL_DRAW, LIVE_PACKED), BALL_TICKET)).toBe(true);
  });

  it('parses the wallet history into a BALL candidate for a known draw', () => {
    const walletTx: TonApiTransaction = {
      hash: 'wallet-buy-ball',
      in_msg: { op_code: '0x7369676e' },
      out_msgs: [
        {
          destination: { address: BALL_DRAW },
          op_code: '0x00001001',
          raw_body: LIVE_BALL_BUY_RAW,
        },
      ],
    };
    const payloads = parseBallBuyPayloads([walletTx], [BALL_KNOWN, HUNDRED_KNOWN]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].packed).toBe(LIVE_PACKED);
    expect(sameAddress(payloads[0].draw.drawAddress, BALL_DRAW)).toBe(true);
    expect(sameAddress(ballTicketAddress(payloads[0].draw.drawAddress, payloads[0].packed), BALL_TICKET)).toBe(
      true,
    );
  });

  it('ignores a 100K BuyTicket body (queryId only) and unknown destinations', () => {
    const walletTx: TonApiTransaction = {
      hash: 'wallet-buy-100k',
      out_msgs: [
        {
          destination: { address: HUNDRED_DRAW },
          op_code: '0x00001001',
          raw_body: LIVE_100K_BUY_RAW,
        },
        {
          destination: { address: `0:${'d'.repeat(64)}` },
          op_code: '0x00001001',
          raw_body: LIVE_BALL_BUY_RAW,
        },
      ],
    };
    expect(parseBallBuyPayloads([walletTx], [BALL_KNOWN, HUNDRED_KNOWN])).toEqual([]);
  });
});

