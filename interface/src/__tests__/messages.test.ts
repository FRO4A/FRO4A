import { Cell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  buildBallBuyTicket,
  buildBallDeployDraw,
  buildBallSweepCompanyFee,
  buildBallTicketAction,
  buildCheckDeadline,
  buildCheckVrfTimeout,
  buildClaim,
  buildCloseExpiredDraw,
  buildForceStartGame,
  buildHundredKBuyTicket,
  buildHundredKCreateDraw,
  buildHundredKSweepCompanyFee,
  buildHundredKTicketAction,
  buildRefund,
  buildRetryRollover,
  toPayloadBase64,
} from '../services/messages';
import { OPCODES } from '../services/opcodes';

function head(cell: Cell): number {
  return cell.beginParse().loadUint(32);
}

describe('verified message payloads and opcodes', () => {
  it('builds BALL BuyTicket (0x1001) with queryId + packedCombination', () => {
    const cell = buildBallBuyTicket(0x1234567890n, 42n);
    const slice = cell.beginParse();
    expect(slice.loadUint(32)).toBe(OPCODES.BuyTicket);
    expect(slice.loadUintBig(64)).toBe(42n);
    expect(slice.loadUintBig(64)).toBe(0x1234567890n);
    expect(slice.remainingBits).toBe(0);
  });

  it('builds 100K BuyTicket (0x1001) with queryId only', () => {
    const cell = buildHundredKBuyTicket(77n);
    const slice = cell.beginParse();
    expect(slice.loadUint(32)).toBe(OPCODES.BuyTicket);
    expect(slice.loadUintBig(64)).toBe(77n);
    expect(slice.remainingBits).toBe(0);
  });

  it('uses 0x3008 / 0x3009 for BALL tickets and 0x3011 / 0x3012 for 100K tickets', () => {
    const ballClaim = buildBallTicketAction('claim', 9n);
    const ballRefund = buildBallTicketAction('refund', 10n);
    expect(head(ballClaim)).toBe(0x3008);
    expect(head(ballRefund)).toBe(0x3009);
    const ballQuery = ballClaim.beginParse();
    expect(ballQuery.loadUint(32)).toBe(0x3008);
    expect(ballQuery.loadUintBig(64)).toBe(9n);

    const hundredClaim = buildHundredKTicketAction('claim');
    const hundredRefund = buildHundredKTicketAction('refund');
    expect(head(hundredClaim)).toBe(0x3011);
    expect(head(hundredRefund)).toBe(0x3012);
    expect(hundredClaim.beginParse().remainingBits).toBe(32);
    expect(hundredRefund.beginParse().remainingBits).toBe(32);
  });

  it('dispatches game-aware Claim / Refund builders', () => {
    expect(head(buildClaim('BALL', 1n))).toBe(0x3008);
    expect(head(buildClaim('100K'))).toBe(0x3011);
    expect(head(buildRefund('BALL', 1n))).toBe(0x3009);
    expect(head(buildRefund('100K'))).toBe(0x3012);
  });

  it('encodes BALL-only fields on admin messages', () => {
    const forceBall = buildForceStartGame('BALL', 5n).beginParse();
    expect(forceBall.loadUint(32)).toBe(0x2001);
    expect(forceBall.loadUintBig(64)).toBe(5n);
    const forceHundred = buildForceStartGame('100K').beginParse();
    expect(forceHundred.loadUint(32)).toBe(0x2001);
    expect(forceHundred.remainingBits).toBe(0);

    const deadlineBall = buildCheckDeadline('BALL', 6n).beginParse();
    expect(deadlineBall.loadUint(32)).toBe(0x2002);
    expect(deadlineBall.loadUintBig(64)).toBe(6n);
    expect(buildCheckDeadline('100K').beginParse().remainingBits).toBe(32);

    const timeoutBall = buildCheckVrfTimeout('BALL', 7n).beginParse();
    expect(timeoutBall.loadUint(32)).toBe(0x2006);
    expect(timeoutBall.loadUintBig(64)).toBe(7n);
    expect(buildCheckVrfTimeout('100K').beginParse().remainingBits).toBe(32);

    const closeBall = buildCloseExpiredDraw('BALL', 8n).beginParse();
    expect(closeBall.loadUint(32)).toBe(0x2008);
    expect(closeBall.loadUintBig(64)).toBe(8n);
    expect(buildCloseExpiredDraw('100K').beginParse().remainingBits).toBe(32);
  });

  it('encodes RetryRollover, DeployDraw and CreateDraw', () => {
    const retry = buildRetryRollover(11n).beginParse();
    expect(retry.loadUint(32)).toBe(0x2007);
    expect(retry.loadUintBig(64)).toBe(11n);

    const deploy = buildBallDeployDraw(4, 12n).beginParse();
    expect(deploy.loadUint(32)).toBe(0x4001);
    expect(deploy.loadUintBig(64)).toBe(12n);
    expect(deploy.loadUint(32)).toBe(4);

    const create = buildHundredKCreateDraw(13n).beginParse();
    expect(create.loadUint(32)).toBe(0x2007);
    expect(create.loadUintBig(64)).toBe(13n);
  });

  it('encodes the BALL sweep amount as coins and the 100K sweep as empty', () => {
    const ball = buildBallSweepCompanyFee(250_000_000n, 14n).beginParse();
    expect(ball.loadUint(32)).toBe(0x2005);
    expect(ball.loadUintBig(64)).toBe(14n);
    expect(ball.loadCoins()).toBe(250_000_000n);

    const hundred = buildHundredKSweepCompanyFee().beginParse();
    expect(hundred.loadUint(32)).toBe(0x2005);
    expect(hundred.remainingBits).toBe(0);
  });

  it('serializes payloads as base64 BOC accepted by @ton/core', () => {
    const payload = toPayloadBase64(buildBallBuyTicket(1n, 2n));
    const parsed = Cell.fromBoc(Buffer.from(payload, 'base64'))[0];
    expect(head(parsed)).toBe(0x1001);
    expect(parsed.beginParse().remainingBits).toBeGreaterThan(0);
  });
});
