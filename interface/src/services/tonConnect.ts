import type { Cell } from '@ton/core';
import { assertActiveNetworkReady, type NetworkName } from '../config/deployments';
import {
  ACTIVE_NETWORK,
  assertSigningAllowed,
  getConnectedTonChain,
} from './networkGuard';
import {
  assertTrustedDrawAddress,
  type DrawAddressReader,
  type DrawTarget,
} from './drawTrust';
import { toPayloadBase64 } from './messages';

export interface TransactionMessage {
  address: string;
  /** Nanotons as a decimal string (TonConnect amount). */
  amount: string;
  payload?: Cell;
}

export interface TransactionSender {
  sendTransaction(transaction: {
    validUntil: number;
    messages: Array<{ address: string; amount: string; payload?: string }>;
  }): Promise<{ boc: string }>;
}

/**
 * Optional draw-address guard: when supplied, the target draw address is
 * verified against the immutable on-chain factory BEFORE the wallet prompt is
 * opened. A spoofed backend `drawAddress` therefore throws
 * `UNTRUSTED_DRAW_ADDRESS` and no signature is ever requested.
 */
export interface GuardedDrawTarget extends DrawTarget {
  /** Test seam only; production always uses the public TonAPI reader. */
  reader?: DrawAddressReader;
  signal?: AbortSignal;
}

/** Optional explicit network context (production defaults to the cached wallet chain). */
export interface NetworkGuardContext {
  chain?: string | number | null;
  network?: NetworkName;
}

/**
 * Single place where UI actions become wallet transactions. The connected
 * wallet signs locally; nothing about the buyer is sent to the FRO4A backend.
 *
 * Guards run BEFORE the wallet prompt:
 *   1. TON Connect chain guard — a Testnet wallet can never sign for a Mainnet
 *      app (and vice versa), blocking Buy / Claim / Refund / ForceStartGame /
 *      Launch Round in both games.
 *   2. The optional `drawTarget` verifies the canonical on-chain draw address
 *      against the immutable factory.
 */
export async function sendTransaction(
  sender: TransactionSender,
  messages: TransactionMessage[],
  drawTarget?: GuardedDrawTarget,
  networkContext: NetworkGuardContext = {},
): Promise<{ boc: string }> {
  if (messages.length === 0) throw new Error('No messages to send');
  // Fail closed before ANY wallet prompt when the Mainnet manifest is incomplete.
  assertActiveNetworkReady();
  assertSigningAllowed(
    networkContext.chain !== undefined ? networkContext.chain : getConnectedTonChain(),
    networkContext.network ?? ACTIVE_NETWORK,
  );
  if (drawTarget !== undefined) {
    await assertTrustedDrawAddress(
      {
        gameType: drawTarget.gameType,
        roundId: drawTarget.roundId,
        drawAddress: drawTarget.drawAddress,
      },
      drawTarget.reader,
      drawTarget.signal,
    );
  }
  return sender.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: messages.map((message) => ({
      address: message.address,
      amount: message.amount.toString(),
      payload: message.payload ? toPayloadBase64(message.payload) : undefined,
    })),
  });
}
