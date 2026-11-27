import { useEffect, useMemo } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { NETWORK, type NetworkName } from '../config/deployments';
import {
  expectedChainFor,
  isWrongTonNetwork,
  setConnectedTonChain,
} from '../services/networkGuard';

export interface TonNetworkGuardState {
  network: NetworkName;
  /** `'-239'` on Mainnet, `'-3'` on Testnet. */
  expectedChain: string;
  walletChain: string | null;
  /** True only for a connected wallet on the wrong TON network. */
  wrongNetwork: boolean;
}

/**
 * Reads `wallet.account.chain` from `@tonconnect/ui-react` and feeds it to the
 * signing guard. The banner and the `sendTransaction` guard share this value, so
 * a wrong-network wallet can never open a signing prompt.
 */
export function useTonNetworkGuard(): TonNetworkGuardState {
  const wallet = useTonWallet();
  const walletChain = wallet?.account?.chain ?? null;

  useEffect(() => {
    setConnectedTonChain(walletChain);
  }, [walletChain]);

  return useMemo(
    () => ({
      network: NETWORK,
      expectedChain: expectedChainFor(NETWORK),
      walletChain,
      wrongNetwork: isWrongTonNetwork(walletChain, NETWORK),
    }),
    [walletChain],
  );
}
