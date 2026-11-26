export interface PricingManifest {
  ticketBody: string;
  companyFee: string;
  ticketPrice: string;
  minBuyValue: string;
  minStorageReserve: string;
}

export interface Deployments {
  network: 'testnet' | 'mainnet';
  /** Manifest version (`v4` for Ticket100kPack + BALL Soulbound contracts). */
  version?: string;
  adminAddress: string;
  treasuryAddress: string;
  vrfPublicKey: string;
  ballFactory: string;
  ballDrawRound1: string;
  draw100kFactory: string;
  draw100kRound1: string;
  /** BALL V4 batch contract parameters (protocol-standard §7.1). */
  ball?: {
    tallyDuration: number;
    nftBaseUrl: string;
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
