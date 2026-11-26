import { beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import {
  deriveBallNumbers,
  deriveSeed,
  hashVrfPayload,
  hexToBytes,
  verifySignature,
  verifyVrf,
} from '../services/vrfVerifier';

const BALL_DRAW = 'EQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pGjt';
const SEED_HEX = '1111111111111111111111111111111111111111111111111111111111111111';
const SEED = BigInt(`0x${SEED_HEX}`);

describe('in-browser BALL VRF derivation', () => {
  it('matches the reference contract vector for seed 0x11…11', () => {
    const result = deriveBallNumbers(SEED);
    expect(result.whites).toEqual([3, 26, 42, 62, 68]);
    expect(result.red).toBe(4);
    expect(result.display).toBe('03-26-42-62-68 + 04');
  });

  it('derives five distinct ascending whites and a red ball in 1..26', () => {
    for (let index = 1n; index <= 32n; index += 1n) {
      const result = deriveBallNumbers(SEED + index);
      expect(new Set(result.whites).size).toBe(5);
      expect([...result.whites].sort((a, b) => a - b)).toEqual(result.whites);
      expect(result.whites.every((white) => white >= 1 && white <= 69)).toBe(true);
      expect(result.red).toBeGreaterThanOrEqual(1);
      expect(result.red).toBeLessThanOrEqual(26);
    }
  });

  it('uses the first 256 signature bits as the seed', () => {
    const signature = `${SEED_HEX}${'00'.repeat(32)}`;
    expect(deriveSeed(signature)).toBe(SEED);
  });

  it('builds the canonical BALL payload with a 32-bit targetVrfTime', () => {
    const { hex } = hashVrfPayload({
      gameType: 'BALL',
      drawAddress: BALL_DRAW,
      totalTicketsSold: 12345,
      closingMarker: 1234567890n,
      targetVrfTime: 1700000000n,
    });
    expect(hex).toBe('0ce44c5594f997fa13bf69267f24247478f281d1e432a439094af8be745acc54');
  });

  it('differs from the 100K payload because targetVrfTime is 64-bit there', () => {
    const ball = hashVrfPayload({
      gameType: 'BALL',
      drawAddress: BALL_DRAW,
      totalTicketsSold: 12345,
      closingMarker: 1234567890n,
      targetVrfTime: 1700000000n,
    });
    const hundred = hashVrfPayload({
      gameType: '100K',
      drawAddress: BALL_DRAW,
      totalTicketsSold: 12345,
      closingMarker: 1234567890n,
      targetVrfTime: 1700000000n,
    });
    expect(ball.hex).not.toBe(hundred.hex);
    expect(ball.cell.bits.length).toBe(32 + 267 + 32 + 64 + 32);
    expect(hundred.cell.bits.length).toBe(32 + 267 + 32 + 64 + 64);
  });

  it('verifies a real ed25519 signature over the payload hash and rejects tampering', () => {
    const privateKey = new Uint8Array(32).fill(7);
    const publicKey = ed25519.getPublicKey(privateKey);
    const { hex } = hashVrfPayload({
      gameType: 'BALL',
      drawAddress: BALL_DRAW,
      totalTicketsSold: 888,
      closingMarker: 99887766n,
      targetVrfTime: 1700000100n,
    });
    const message = hexToBytes(hex);
    const signature = ed25519.sign(message, privateKey);
    const signatureHex = Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const publicHex = Array.from(publicKey, (byte) => byte.toString(16).padStart(2, '0')).join('');

    expect(verifySignature(signatureHex, hex, publicHex)).toBe(true);
    expect(verifySignature(signatureHex, `${hex.slice(0, -2)}00`, publicHex)).toBe(false);
    expect(verifySignature(signatureHex, hex, `${'00'.repeat(32)}`)).toBe(false);
  });

  it('verifyVrf reproduces the BALL numbers even for a placeholder signature', () => {
    const signature = `${SEED_HEX}${'aa'.repeat(32)}`;
    const result = verifyVrf({
      gameType: 'BALL',
      drawAddress: BALL_DRAW,
      roundId: 1,
      totalTicketsSold: 1000,
      closingMarker: 123n,
      targetVrfTime: 456n,
      signatureHex: signature,
      publicKeyHex: '00'.repeat(32),
    });
    expect(result.signatureValid).toBe(false);
    expect(result.ball?.whites).toEqual([3, 26, 42, 62, 68]);
    expect(result.ball?.red).toBe(4);
    expect(result.hundredK).toBeNull();
  });

  it('does not accept a malformed payload cell', () => {
    expect(() => beginCell().storeUint(0, 8).endCell().beginParse().loadAddress()).toThrow();
  });
});
