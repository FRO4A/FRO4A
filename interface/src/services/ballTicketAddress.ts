import { Address, beginCell, contractAddress } from '@ton/core';
import { ballTicketCode } from './ballTicketCode';

/**
 * Deterministic V5 `BallTicket` address, computed fully client-side.
 *
 * The ticket is a plain on-chain receipt. The address is simply
 * `contractAddress(initOf BallTicket(drawAddress, packedCombination))`:
 *
 *   data = 0:1 | drawAddress:Address | packedCombination:uint64
 *
 * Therefore `ballTicketAddress(draw, packed)` is exactly the address the draw
 * deploys in `QuotaGranted`, without any RPC round-trip. It is the V5 replacement
 * for the old ticket-address derivation (no token collection is involved).
 */
export function ballTicketAddress(drawAddress: string, packedCombination: bigint): string {
  const draw = Address.parse(drawAddress);
  const data = beginCell()
    .storeUint(0, 1)
    .storeAddress(draw)
    .storeUint(packedCombination, 64)
    .endCell();
  return contractAddress(0, { code: ballTicketCode(), data }).toString({ bounceable: true });
}
