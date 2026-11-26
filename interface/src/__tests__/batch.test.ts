import { describe, expect, it } from 'vitest';
import type { TransactionMessage, TransactionSender } from '../services/tonConnect';
import { buildBallBuyTicketBatch, buildHundredKBuyTicketBatch } from '../services/messages';
import { OPCODES } from '../services/opcodes';
import {
  ABSOLUTE_MAX_MESSAGES,
  DEFAULT_MAX_MESSAGES,
  chunkMessages,
  maxMessagesForWallet,
  sendBatchedTransactions,
  type BatchProgress,
} from '../services/tonTransactions';

function message(index: number): TransactionMessage {
  return { address: `EQ${index}`, amount: '1000' };
}

describe('wallet multi-message capability', () => {
  it('reads SendTransaction.maxMessages from wallet features', () => {
    expect(maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction', maxMessages: 255 }] } })).toBe(
      255,
    );
    expect(maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction', maxMessages: 4 }] } })).toBe(4);
  });

  it('defaults safely to 4 when the capability is unknown', () => {
    expect(maxMessagesForWallet(null)).toBe(DEFAULT_MAX_MESSAGES);
    expect(maxMessagesForWallet(undefined)).toBe(DEFAULT_MAX_MESSAGES);
    expect(maxMessagesForWallet({})).toBe(DEFAULT_MAX_MESSAGES);
    expect(maxMessagesForWallet({ device: { features: [] } })).toBe(DEFAULT_MAX_MESSAGES);
    expect(maxMessagesForWallet({ device: { features: [{ name: 'SignData' }] } })).toBe(DEFAULT_MAX_MESSAGES);
    expect(maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction' }] } })).toBe(
      DEFAULT_MAX_MESSAGES,
    );
  });

  it('clamps nonsense and oversized limits', () => {
    expect(maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction', maxMessages: 0 }] } })).toBe(
      DEFAULT_MAX_MESSAGES,
    );
    expect(
      maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction', maxMessages: -5 }] } }),
    ).toBe(DEFAULT_MAX_MESSAGES);
    expect(
      maxMessagesForWallet({ device: { features: [{ name: 'SendTransaction', maxMessages: 1000 }] } }),
    ).toBe(ABSOLUTE_MAX_MESSAGES);
  });
});

describe('multi-message batch chunking', () => {
  it('splits 10 tickets into 4 + 4 + 2 for a wallet limited to 4 messages', () => {
    const batches = chunkMessages(Array.from({ length: 10 }, (_, index) => message(index)), 4);
    expect(batches.map((batch) => batch.items.length)).toEqual([4, 4, 2]);
    expect(batches.map((batch) => batch.index)).toEqual([1, 2, 3]);
    expect(batches.every((batch) => batch.total === 3)).toBe(true);
  });

  it('keeps 100 tickets in a single batch for a W5 wallet with maxMessages 255', () => {
    const batches = chunkMessages(Array.from({ length: 100 }, (_, index) => message(index)), 255);
    expect(batches).toHaveLength(1);
    expect(batches[0].items).toHaveLength(100);
    expect(batches[0].total).toBe(1);
  });

  it('is defensive about empty input and invalid limits', () => {
    expect(chunkMessages([], 4)).toEqual([]);
    expect(chunkMessages([message(1)], 0)).toHaveLength(1);
    expect(chunkMessages([message(1), message(2)], 0)[0].items).toHaveLength(2);
  });

  it('sends every batch sequentially and reports exact progress', () => {
    const calls: TransactionMessage[][] = [];
    const sender: TransactionSender = {
      async sendTransaction(transaction) {
        calls.push(
          transaction.messages.map((item) => ({ address: item.address, amount: item.amount })),
        );
        return { boc: `boc-${calls.length}` };
      },
    };
    const progress: BatchProgress[] = [];
    const messages = Array.from({ length: 5 }, (_, index) => message(index));
    const batches = chunkMessages(messages, 2);
    return sendBatchedTransactions(sender, batches, (value) => progress.push(value)).then((bocs) => {
      expect(bocs).toEqual(['boc-1', 'boc-2', 'boc-3']);
      expect(calls.map((batch) => batch.length)).toEqual([2, 2, 1]);
      expect(progress).toEqual([
        { batch: 1, total: 3, ticketsInBatch: 2, ticketsSent: 0, ticketsTotal: 5 },
        { batch: 2, total: 3, ticketsInBatch: 2, ticketsSent: 2, ticketsTotal: 5 },
        { batch: 3, total: 3, ticketsInBatch: 1, ticketsSent: 4, ticketsTotal: 5 },
      ]);
    });
  });
});

describe('multi-ticket BuyTicket payload builders', () => {
  it('builds one BALL 0x1001 payload per combination with unique queryIds and exact packing', () => {
    const payloads = buildBallBuyTicketBatch([11n, 22n, 33n], 1_000n);
    expect(payloads).toHaveLength(3);
    payloads.forEach((payload, index) => {
      const slice = payload.beginParse();
      expect(slice.loadUint(32)).toBe(OPCODES.BuyTicket);
      expect(slice.loadUintBig(64)).toBe(1_000n + BigInt(index));
      expect(slice.loadUintBig(64)).toBe(BigInt((index + 1) * 11));
      expect(slice.remainingBits).toBe(0);
    });
  });

  it('builds one 100K 0x1001 payload per ticket with unique queryIds', () => {
    const payloads = buildHundredKBuyTicketBatch(4, 5_000n);
    expect(payloads).toHaveLength(4);
    const queryIds = payloads.map((payload) => {
      const slice = payload.beginParse();
      expect(slice.loadUint(32)).toBe(OPCODES.BuyTicket);
      const queryId = slice.loadUintBig(64);
      expect(slice.remainingBits).toBe(0);
      return queryId.toString();
    });
    expect(new Set(queryIds).size).toBe(4);
    expect(queryIds).toEqual(['5000', '5001', '5002', '5003']);
  });

  it('returns no payloads for zero tickets', () => {
    expect(buildBallBuyTicketBatch([], 1n)).toEqual([]);
    expect(buildHundredKBuyTicketBatch(0, 1n)).toEqual([]);
  });
});
