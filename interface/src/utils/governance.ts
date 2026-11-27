import { ACTIVE_DEPLOYMENTS } from '../config/deployments';
import { sameAddress } from './address';

/**
 * Pinned governance identity (anti-spoofing).
 *
 * The backend mirrors `adminAddress` / `treasuryAddress` for convenience, but a
 * compromised API (or MITM) could return ANY address there. Those values are
 * therefore never used to authorise UI: the repository-controlled deployment
 * manifest is the single source of truth for who is ADMIN / TREASURY.
 *
 * Even if a spoofed payload made a random wallet look like an admin, every
 * resulting signing path is still bound to the pinned canonical factory
 * (`assertCanonicalFactoryTarget`), the canonical draw (`drawTrust.ts`) and the
 * genuine ticket contract (`ticketTrust.ts`), so no fund-moving transaction can
 * be redirected. Ignoring the API addresses removes the confusion entirely.
 */

/** Canonical admin wallet from the pinned manifest (never the API value). */
export function pinnedAdminAddress(): string {
  return ACTIVE_DEPLOYMENTS.adminAddress;
}

/** Canonical treasury wallet from the pinned manifest (never the API value). */
export function pinnedTreasuryAddress(): string {
  return ACTIVE_DEPLOYMENTS.treasuryAddress;
}

/** True only for the pinned admin wallet. */
export function isPinnedAdmin(walletAddress: string | null | undefined): boolean {
  return sameAddress(walletAddress, pinnedAdminAddress());
}

/** True only for the pinned treasury wallet. */
export function isPinnedTreasury(walletAddress: string | null | undefined): boolean {
  return sameAddress(walletAddress, pinnedTreasuryAddress());
}
