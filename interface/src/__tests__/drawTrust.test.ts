import { Address } from '@ton/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_DEPLOYMENTS } from '../config/deployments';
import {
  assertTrustedDrawAddress,
  DrawAddressSecurityError,
  resetDrawAddressCache,
  UNTRUSTED_DRAW_ADDRESS,
  UNVERIFIABLE_DRAW_ADDRESS,
  type DrawAddressReader,
} from '../services/drawTrust';
import { sendTransaction, type TransactionMessage, type TransactionSender } from '../services/tonConnect';

const SPOOFED = Address.parseRaw(`0:${'11'.repeat(32)}`).toString({ bounceable: true });

function readerReturning(address: string | null): { reader: DrawAddressReader; calls: () => number } {
  let calls = 0;
  return {
    reader: async () => {
      calls += 1;
      return address;
    },
    calls: () => calls,
  };
}

describe('on-chain draw address verification', () => {
  beforeEach(() => {
    resetDrawAddressCache();
  });

  it('accepts the canonical factory address for a dynamic round and caches it', async () => {
    const { reader, calls } = readerReturning(ACTIVE_DEPLOYMENTS.ballDrawRound1);
    const target = {
      gameType: 'BALL' as const,
      roundId: 2,
      drawAddress: ACTIVE_DEPLOYMENTS.ballDrawRound1,
    };
    await expect(assertTrustedDrawAddress(target, reader)).resolves.toBe(
      ACTIVE_DEPLOYMENTS.ballDrawRound1,
    );
    await expect(assertTrustedDrawAddress(target, reader)).resolves.toBe(
      ACTIVE_DEPLOYMENTS.ballDrawRound1,
    );
    // Cached per gameType:roundId — exactly one RPC read.
    expect(calls()).toBe(1);
  });

  it('rejects a spoofed API drawAddress with UNTRUSTED_DRAW_ADDRESS', async () => {
    const { reader } = readerReturning(ACTIVE_DEPLOYMENTS.draw100kRound1);
    await expect(
      assertTrustedDrawAddress({ gameType: '100K', roundId: 5, drawAddress: SPOOFED }, reader),
    ).rejects.toMatchObject({ code: UNTRUSTED_DRAW_ADDRESS });
  });

  it('blocks the TON Connect prompt completely when the draw is spoofed', async () => {
    const { reader } = readerReturning(ACTIVE_DEPLOYMENTS.ballDrawRound1);
    let prompts = 0;
    const sender: TransactionSender = {
      async sendTransaction() {
        prompts += 1;
        return { boc: 'signed' };
      },
    };
    const messages: TransactionMessage[] = [{ address: SPOOFED, amount: '300000000' }];

    await expect(
      sendTransaction(sender, messages, {
        gameType: 'BALL',
        roundId: 3,
        drawAddress: SPOOFED,
        reader,
      }),
    ).rejects.toBeInstanceOf(DrawAddressSecurityError);
    expect(prompts).toBe(0);

    await expect(
      sendTransaction(sender, messages, {
        gameType: 'BALL',
        roundId: 3,
        drawAddress: ACTIVE_DEPLOYMENTS.ballDrawRound1,
        reader,
      }),
    ).resolves.toEqual({ boc: 'signed' });
    expect(prompts).toBe(1);
  });

  it('uses the repository manifest anchor for round 1 when the RPC is unavailable', async () => {
    const { reader } = readerReturning(null);
    await expect(
      assertTrustedDrawAddress(
        { gameType: 'BALL', roundId: 1, drawAddress: ACTIVE_DEPLOYMENTS.ballDrawRound1 },
        reader,
      ),
    ).resolves.toBe(ACTIVE_DEPLOYMENTS.ballDrawRound1);

    resetDrawAddressCache();
    await expect(
      assertTrustedDrawAddress({ gameType: 'BALL', roundId: 1, drawAddress: SPOOFED }, reader),
    ).rejects.toMatchObject({ code: UNTRUSTED_DRAW_ADDRESS });
  });

  it('fails closed for a non-round-1 draw that cannot be verified on-chain', async () => {
    const { reader } = readerReturning(null);
    await expect(
      assertTrustedDrawAddress(
        { gameType: '100K', roundId: 7, drawAddress: ACTIVE_DEPLOYMENTS.draw100kRound1 },
        reader,
      ),
    ).rejects.toMatchObject({ code: UNVERIFIABLE_DRAW_ADDRESS });
  });

  it('rejects an invalid roundId as untrusted', async () => {
    const { reader } = readerReturning(ACTIVE_DEPLOYMENTS.ballDrawRound1);
    await expect(
      assertTrustedDrawAddress({ gameType: 'BALL', roundId: 0, drawAddress: SPOOFED }, reader),
    ).rejects.toMatchObject({ code: UNTRUSTED_DRAW_ADDRESS });
  });
});
