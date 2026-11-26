import { useMemo } from 'react';
import type { UserRole } from '../types/game';
import { detectRole } from '../utils/address';

export function useRole(
  walletAddress: string | null | undefined,
  adminAddress: string | null | undefined,
  treasuryAddress: string | null | undefined,
): UserRole {
  return useMemo(() => detectRole(walletAddress, adminAddress, treasuryAddress), [walletAddress, adminAddress, treasuryAddress]);
}
