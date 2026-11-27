export interface PricingManifest {
  ticketBody: string;
  companyFee: string;
  ticketPrice: string;
  minBuyValue: string;
  minStorageReserve: string;
}

export interface Deployments {
  network: 'testnet' | 'mainnet';
  /** Manifest version (`v5` for the BallTicket / Ticket100kPack build). */
  version?: string;
  /**
   * Canonical public addresses. On an undeployed Mainnet these are `''` and the
   * UI refuses to build any factory / draw transaction (fail-closed).
   * Round-1 addresses are `''` until the Admin launches the first round.
   */
  adminAddress: string;
  treasuryAddress: string;
  vrfPublicKey: string;
  ballFactory: string;
  ballDrawRound1: string;
  draw100kFactory: string;
  draw100kRound1: string;
  /** BALL V5 batch contract parameters (protocol-standard §7.1). */
  ball?: {
    tallyDuration: number;
    maxBatchSize: number;
    batchBaseGas: string;
    mintValue: string;
    ticketStorageReserve: string;
  };
  /** 100K V4 pack contract parameters (protocol-standard §7.2). */
  hundredK?: {
    maxPackSize: number;
    batchGasBuffer: string;
    packStorageReserve: string;
  };
  pricing: {
    ball: PricingManifest;
    '100k': PricingManifest;
  };
  deployedAt: string;
}
