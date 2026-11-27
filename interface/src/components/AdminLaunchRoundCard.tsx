import { useState } from 'react';
import { PlayCircle, Rocket, ShieldAlert } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import type { GameType } from '../types/game';
import { useI18n } from '../i18n';
import { v5Copy } from '../i18n/v5Messages';
import { useApiResource } from '../hooks/useApiResource';
import { readFactoryNextRound } from '../services/tonChain';
import { GAS, OPCODES } from '../services/opcodes';
import { buildBallDeployDraw, buildHundredKCreateDraw } from '../services/messages';
import {
  assertCanonicalFactoryTarget,
  BLOCKED_TRANSACTION_MESSAGE,
  DrawAddressSecurityError,
} from '../services/drawTrust';
import { WrongTonNetworkError } from '../services/networkGuard';
import { sendTransaction } from '../services/tonConnect';

/**
 * Admin-only round launcher (V5: round starts are admin-only).
 *
 * Visible whenever no open round exists (`pending/waiting`, or the previous round
 * is settled/cancelled). Sends the exact V5 factory payload:
 *   BALL  -> DeployDraw  (0x4001) queryId:uint64, roundId:uint32
 *   100K  -> CreateDraw  (0x2007) queryId:uint64
 *
 * The target is asserted against the pinned canonical factory before the wallet
 * prompt; an undeployed Mainnet manifest disables the action entirely.
 */
export function AdminLaunchRoundCard({
  gameType,
  factoryAddress,
  onDone,
}: {
  gameType: GameType;
  factoryAddress: string;
  onDone: () => void;
}): JSX.Element {
  const { locale } = useI18n();
  const copy = v5Copy(locale);
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const missingFactory = factoryAddress.trim().length === 0;

  const nextRound = useApiResource<number>(
    (signal) =>
      missingFactory ? Promise.resolve(1) : readFactoryNextRound(gameType, factoryAddress, signal),
    [gameType, factoryAddress, missingFactory],
    0,
  );

  const roundToLaunch = nextRound.data;
  const label =
    roundToLaunch !== null && roundToLaunch > 1 ? copy.launchNewRound : copy.launchRoundFirst;

  const launch = async (): Promise<void> => {
    if (missingFactory || status === 'sending') return;
    setStatus('sending');
    setMessage(null);
    try {
      // Admin factory call: ONLY the pinned canonical factory address is allowed.
      assertCanonicalFactoryTarget(gameType, factoryAddress);
      const payload =
        gameType === 'BALL' ? buildBallDeployDraw(roundToLaunch ?? 1) : buildHundredKCreateDraw();
      const amount = gameType === 'BALL' ? GAS.BALL_DEPLOY_DRAW : GAS.HUNDRED_K_CREATE_DRAW;
      await sendTransaction(tonConnectUI, [
        { address: factoryAddress, amount: amount.toString(), payload },
      ]);
      setStatus('success');
      setMessage(copy.launchRoundSuccess);
      nextRound.refresh();
      window.setTimeout(onDone, 5_000);
    } catch (error) {
      setStatus('error');
      if (error instanceof WrongTonNetworkError) setMessage(copy.wrongNetworkTitle);
      else if (error instanceof DrawAddressSecurityError) setMessage(BLOCKED_TRANSACTION_MESSAGE);
      else setMessage(copy.launchRoundError);
    }
  };

  return (
    <section
      className="glass p-4 sm:p-5"
      aria-label={label}
      data-testid="admin-launch-round"
      data-game={gameType}
    >
      <div className="flex items-start gap-3">
        <span className="glass-icon h-11 w-11 shrink-0 rounded-2xl">
          {missingFactory ? <ShieldAlert size={21} strokeWidth={1.75} /> : <Rocket size={21} strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
          {missingFactory ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[var(--warning)]">{copy.factoryMissingTitle}</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-secondary">{copy.factoryMissingBody}</p>
            </>
          ) : (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-secondary">{copy.launchRoundHint}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={missingFactory || status === 'sending'}
              onClick={() => void launch()}
            >
              <PlayCircle size={17} strokeWidth={1.75} />
              {status === 'sending' ? '…' : label}
            </button>
            {!missingFactory && roundToLaunch !== null ? (
              <span className="pill pill-neutral">
                {gameType === 'BALL' ? 'DeployDraw' : 'CreateDraw'} 0x
                {(gameType === 'BALL' ? OPCODES.BallDeployDraw : OPCODES.HundredKCreateDraw).toString(16)} · #
                {roundToLaunch}
              </span>
            ) : null}
          </div>

          {message !== null ? (
            <p
              className={
                status === 'success'
                  ? 'mt-2 text-xs text-[var(--success)]'
                  : 'mt-2 text-xs text-[var(--danger)]'
              }
              role={status === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
