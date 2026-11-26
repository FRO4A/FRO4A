import type { Cell } from '@ton/core';
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
 * Single place where UI actions become wallet transactions. The connected
 * wallet signs locally; nothing about the buyer is sent to the FRO4A backend.
 */
export async function sendTransaction(
  sender: TransactionSender,
  messages: TransactionMessage[],
): Promise<{ boc: string }> {
  if (messages.length === 0) throw new Error('No messages to send');
  return sender.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: messages.map((message) => ({
      address: message.address,
      amount: message.amount.toString(),
      payload: message.payload ? toPayloadBase64(message.payload) : undefined,
    })),
  });
}
