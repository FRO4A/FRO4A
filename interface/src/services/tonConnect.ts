import type { Cell } from '@ton/core';
import { assertActiveNetworkReady, type NetworkName } from '../config/deployments';
import {
  ACTIVE_NETWORK,
  assertSigningAllowed,
  getConnectedTonChain,
} from './networkGuard';
import {
  assertTrustedDrawAddress,
  DrawAddressSecurityError,
  UNTRUSTED_DRAW_ADDRESS,
  type DrawAddressReader,
  type DrawTarget,
} from './drawTrust';
import {
  assertTrustedTicketAddress,
  TicketAddressSecurityError,
  UNTRUSTED_TICKET_ADDRESS,
  type PackStateReader,
  type TicketContractGuard,
} from './ticketTrust';
import { sameAddress } from '../utils/address';
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
  /**
   * Claim / Refund only: the message must go to the GENUINE ticket / pack
   * contract, proven locally (BALL) or on-chain (100K) before the prompt.
   */
  ticket?: TicketContractGuard;
  /** Test seam only for the 100K `getPackInfo()` reader. */
  packReader?: PackStateReader;
}

/** Optional explicit network context (production defaults to the cached wallet chain). */
export interface NetworkGuardContext {
  chain?: string | number | null;
  network?: NetworkName;
}

/**
 * A wallet signature must never fan out to an unverified destination: every
 * message of the batch has to target the address that was just proven.
 */
function assertDrawMessages(messages: readonly TransactionMessage[], expected: string): void {
  for (const message of messages) {
    if (!sameAddress(message.address, expected)) {
      throw new DrawAddressSecurityError(
        UNTRUSTED_DRAW_ADDRESS,
        `Blocked transaction: message to ${message.address} is not the verified draw ${expected}`,
      );
    }
  }
}

function assertTicketMessages(messages: readonly TransactionMessage[], expected: string): void {
  for (const message of messages) {
    if (!sameAddress(message.address, expected)) {
      throw new TicketAddressSecurityError(
        UNTRUSTED_TICKET_ADDRESS,
        `Blocked transaction: message to ${message.address} is not the verified ticket ${expected}`,
      );
    }
  }
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
 *   3. When `drawTarget.ticket` is present (Claim / Refund), the destination
 *      ticket / pack contract itself is verified: BALL by local deterministic
 *      V5 address derivation, 100K by `getPackInfo()` (canonical draw + owner).
 *   4. Every message in the batch must target the verified contract, so a
 *      hostile payload cannot smuggle an extra transfer into the same prompt.
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
    const canonicalDraw = await assertTrustedDrawAddress(
      {
        gameType: drawTarget.gameType,
        roundId: drawTarget.roundId,
        drawAddress: drawTarget.drawAddress,
      },
      drawTarget.reader,
      drawTarget.signal,
    );
    const ticket = drawTarget.ticket;
    if (ticket === undefined) {
      assertDrawMessages(messages, canonicalDraw);
    } else {
      // Claim / Refund: the destination contract itself must be genuine.
      const verifiedTicket =
        drawTarget.gameType === 'BALL'
          ? await assertTrustedTicketAddress({
              gameType: 'BALL',
              drawAddress: canonicalDraw,
              ticketAddress: ticket.address,
              packedCombination: ticket.packedCombination ?? null,
            })
          : await assertTrustedTicketAddress({
              gameType: '100K',
              drawAddress: canonicalDraw,
              ticketAddress: ticket.address,
              expectedOwner: ticket.owner ?? '',
              reader: drawTarget.packReader,
              signal: drawTarget.signal,
            });
      assertTicketMessages(messages, verifiedTicket);
    }
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
