/**
 * AUTO-GENERATED FILE — do not edit by hand.
 *
 * Source of truth: `shared/deployments/mainnet.json` (public addresses and
 * immutable parameters only — never a secret).
 *
 * Regenerate after the Step 4 Mainnet deployment with:
 *   node C:\FRO4A\scripts\sync-mainnet-manifest-to-interface.mjs
 *
 * While a factory is `null` the interface refuses to build a Mainnet factory
 * transaction (`assertActiveNetworkReady` in `deployments.ts` fails closed).
 */

export interface MainnetPricingManifest {
  ticketBody: string;
  companyFee: string;
  ticketPrice: string;
  minBuyValue: string;
  minStorageReserve: string;
}

export interface MainnetDeploymentManifest {
  network: 'mainnet';
  version: string;
  adminAddress: string | null;
  treasuryAddress: string | null;
  vrfPublicKey: string | null;
  ballFactory: string | null;
  ballDrawRound1: string | null;
  draw100kFactory: string | null;
  draw100kRound1: string | null;
  ball: {
    tallyDuration: number;
    maxBatchSize: number;
    batchBaseGas: string;
    mintValue: string;
    ticketStorageReserve: string;
  } | null;
  hundredK: {
    maxPackSize: number;
    batchGasBuffer: string;
    packStorageReserve: string;
  } | null;
  pricing: {
    ball: MainnetPricingManifest | null;
    '100k': MainnetPricingManifest | null;
  };
  deployedAt: string | null;
}

/** Canonical V5 Mainnet deployment (public data only). */
export const MAINNET_DEPLOYMENT: MainnetDeploymentManifest = {
  network: 'mainnet',
  version: "v5",
  adminAddress: "EQDgAdw-UczCsMGAgNylgMD3QVqFrNxXC13HLOYUdOwfP1vD",
  treasuryAddress: "EQAezSzNxjRFS7pXU_N1Nyf86iHYdEVYgIC6t05wbEexMEHk",
  vrfPublicKey: "c634fca9c29875dcf5378528d48183c38e6699376c1fbce75804d68bdd04db2b",
  ballFactory: "EQDf5O4YBlMcb0EFcRAPzlQ95Vndaw98HOhb0MReqi6FqIbN",
  ballDrawRound1: null,
  draw100kFactory: "EQBXh5mLqFMFnWBYWOE8S8t1piy97bJhxa9u2V4ein-FnGL_",
  draw100kRound1: null,
  ball: {
    tallyDuration: 7200,
    maxBatchSize: 12,
    batchBaseGas: "80000000",
    mintValue: "60000000",
    ticketStorageReserve: "12000000",
  },
  hundredK: {
    maxPackSize: 100,
    batchGasBuffer: "100000000",
    packStorageReserve: "12000000",
  },
  pricing: {
    ball: {
      ticketBody: "2000000000",
      companyFee: "200000000",
      ticketPrice: "2200000000",
      minBuyValue: "2280000000",
      minStorageReserve: "2000000000",
    },
    '100k': {
      ticketBody: "1000000000",
      companyFee: "100000000",
      ticketPrice: "1100000000",
      minBuyValue: "1180000000",
      minStorageReserve: "2000000000",
    },
  },
  deployedAt: "2026-11-27T18:16:03.427Z",
};

/** True for a non-empty TON address string (never for `null` / `''`). */
export function isConfiguredAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** The two canonical Mainnet factories required before any round can launch. */
export function isMainnetFactoryConfigured(
  manifest: Pick<MainnetDeploymentManifest, 'ballFactory' | 'draw100kFactory'> = MAINNET_DEPLOYMENT,
): boolean {
  return isConfiguredAddress(manifest.ballFactory) && isConfiguredAddress(manifest.draw100kFactory);
}

/** Missing canonical factory names (empty when Mainnet is ready). */
export function missingMainnetFactories(
  manifest: Pick<MainnetDeploymentManifest, 'ballFactory' | 'draw100kFactory'> = MAINNET_DEPLOYMENT,
): string[] {
  const missing: string[] = [];
  if (!isConfiguredAddress(manifest.ballFactory)) missing.push('ballFactory');
  if (!isConfiguredAddress(manifest.draw100kFactory)) missing.push('draw100kFactory');
  return missing;
}
