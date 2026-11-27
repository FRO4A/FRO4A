import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Minus, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { VerifyResponse } from '../types/api';
import type { GameSlug, GameType } from '../types/game';
import { placeForWinnerIndex } from '../types/game';
import { useI18n } from '../i18n';
import { useApiResource } from '../hooks/useApiResource';
import { fetchCurrentDraw, fetchHistory, fetchVerification } from '../services/api';
import { ACTIVE_DEPLOYMENTS, tonviewerAddressUrl } from '../config/deployments';
import { safeExternalUrl } from '../utils/externalUrl';
import { isPendingRound } from '../utils/roundState';
import { WaitingForRoundCard } from '../components/WaitingForRoundCard';
import { drawStatusKey } from '../utils/status';
import { verifyVrf, type VerificationResult } from '../services/vrfVerifier';
import { formatTonFromNano } from '../utils/format';
import {
  buildVerifierRounds,
  isVerifiableRoundStatus,
  latestKnownRoundId,
  pickDefaultVerifierRound,
  type VerifierRoundOption,
} from '../utils/verifierRounds';
import { BallSet, TicketNumberChip } from '../components/ui/Ball';
import { ErrorState } from '../components/ui/States';
import { SectionHeader } from '../components/ui/StatCard';
import { cn } from '../utils/cn';

interface FormState {
  drawAddress: string;
  totalTicketsSold: string;
  closingMarker: string;
  targetVrfTime: string;
  roundId: string;
  signatureHex: string;
  publicKeyHex: string;
}

const EMPTY_FORM: FormState = {
  drawAddress: '',
  totalTicketsSold: '',
  closingMarker: '',
  targetVrfTime: '',
  roundId: '',
  signatureHex: '',
  publicKeyHex: ACTIVE_DEPLOYMENTS.vrfPublicKey,
};

function toUnixSeconds(iso: string | null): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? Math.floor(time / 1000).toString() : '';
}

function formFromProof(proof: VerifyResponse): FormState {
  return {
    drawAddress: proof.drawAddress,
    totalTicketsSold: String(proof.totalTicketsSold),
    closingMarker: proof.closingMarker ?? '',
    targetVrfTime: toUnixSeconds(proof.targetVrfTime),
    roundId: String(proof.roundId),
    signatureHex: proof.vrfSignatureHex ?? '',
    publicKeyHex: proof.vrfPublicKey ?? ACTIVE_DEPLOYMENTS.vrfPublicKey,
  };
}

function slugFor(gameType: GameType): GameSlug {
  return gameType === 'BALL' ? 'ball' : '100k';
}

/** Option label for the round selector (status + winner count when indexed). */
function roundOptionLabel(t: ReturnType<typeof useI18n>['t'], round: VerifierRoundOption): string {
  const parts = [`#${round.roundId}`];
  if (round.status === null) {
    parts.push(t('verify.roundUnknown'));
  } else {
    parts.push(t(`status.${drawStatusKey(round.status)}`));
    if (round.winnerCount !== null) parts.push(`${t('common.winners')} ${round.winnerCount}`);
  }
  return parts.join(' · ');
}

export function VerifierPage(): JSX.Element {
  const { t } = useI18n();
  const [gameType, setGameType] = useState<GameType>('BALL');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('verify.title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-secondary">{t('verify.subtitle')}</p>
        </div>
        <span className="pill pill-neutral min-w-0 max-w-full !whitespace-normal break-words !leading-snug !rounded-2xl sm:!rounded-full">
          {t('verify.localOnly')}
        </span>
      </div>

      {/*
        `key={gameType}` fully isolates the two verifiers: switching BALL <-> 100K
        unmounts the workspace, so no proof, result, error or round state from the
        previous game can ever leak into the other one.
      */}
      <GameVerifier key={gameType} gameType={gameType} onGameChange={setGameType} />
    </div>
  );
}

function GameVerifier({
  gameType,
  onGameChange,
}: {
  gameType: GameType;
  onGameChange: (game: GameType) => void;
}): JSX.Element {
  const { t } = useI18n();
  const slug = slugFor(gameType);
  const [roundId, setRoundId] = useState('');
  const [typedRound, setTypedRound] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [proof, setProof] = useState<VerifyResponse | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [resultMatches, setResultMatches] = useState<boolean | null>(null);
  const [payloadMatches, setPayloadMatches] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const loadTokenRef = useRef(0);
  const aliveRef = useRef(true);

  // 100 is the API maximum: both archives always fit in one page.
  const history = useApiResource((signal) => fetchHistory(slug, 100, 1, signal), [slug], 0);
  const active = useApiResource((signal) => fetchCurrentDraw(slug, signal), [slug], 0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      loadTokenRef.current += 1;
    };
  }, []);

  const pendingRound = active.data !== null && isPendingRound(active.data);

  // The active draw is the most reliable source for `latestRoundId` even when
  // the history response omits a past round or fails entirely. A pending
  // zero-round payload never contributes a fake Round #1.
  const latestRoundId = useMemo(
    () =>
      pendingRound
        ? latestKnownRoundId([
            ...(history.data?.items ?? []).map((item) => ({ roundId: item.roundId, status: item.status })),
          ])
        : latestKnownRoundId([
            active.data === null ? null : { roundId: active.data.roundId, status: active.data.status },
            ...(history.data?.items ?? []).map((item) => ({ roundId: item.roundId, status: item.status })),
          ]),
    [active.data, history.data, pendingRound],
  );

  // Full `[latest .. 1]` list: completed round #1 stays selectable while #2 runs.
  const rounds = useMemo(
    () =>
      buildVerifierRounds({
        history: (history.data?.items ?? []).map((item) => ({
          roundId: item.roundId,
          status: item.status,
          winnerCount: item.winnerCount,
        })),
        active:
          active.data === null || pendingRound
            ? null
            : { roundId: active.data.roundId, status: active.data.status },
        latestRoundId,
        selectedRoundId: Number.parseInt(roundId, 10) || null,
      }),
    [history.data, active.data, latestRoundId, roundId, pendingRound],
  );

  // Auto-select the newest verifiable round as soon as one round source answers;
  // the synthesized list makes Round #1 available even before history settles.
  useEffect(() => {
    if (roundId !== '' || pendingRound) return;
    const hasRoundData = (active.data !== null && !pendingRound) || history.data !== null;
    const bothSettled = !active.loading && !history.loading;
    if (!hasRoundData && !bothSettled) return;
    const next = pickDefaultVerifierRound(rounds, latestRoundId);
    if (next !== null) setRoundId(String(next));
  }, [roundId, rounds, latestRoundId, history.data, history.loading, active.data, active.loading, pendingRound]);

  const run = (source: FormState, published: VerifyResponse | null): void => {
    setError(null);
    try {
      const total = Number.parseInt(source.totalTicketsSold, 10);
      const round = Number.parseInt(source.roundId, 10);
      const target = BigInt(source.targetVrfTime);
      const closing = BigInt(source.closingMarker);
      if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(round) || target <= 0n) {
        setError(t('verify.errorInvalid'));
        return;
      }
      if (source.signatureHex.trim().length !== 128 || source.publicKeyHex.trim().length !== 64) {
        setError(t('verify.errorMissing'));
        return;
      }
      const verification = verifyVrf({
        gameType,
        drawAddress: source.drawAddress,
        roundId: round,
        totalTicketsSold: total,
        closingMarker: closing,
        targetVrfTime: target,
        signatureHex: source.signatureHex.trim(),
        publicKeyHex: source.publicKeyHex.trim(),
      });
      setResult(verification);
      setPayloadMatches(published?.vrfPayloadHex ? verification.payloadHex === published.vrfPayloadHex : null);
      setResultMatches(compareResult(verification, published, gameType));
    } catch {
      setError(t('verify.errorInvalid'));
      setResult(null);
      setResultMatches(null);
      setPayloadMatches(null);
    }
  };

  const loadProof = async (numericRound: number): Promise<void> => {
    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    setLoadingProof(true);
    setError(null);
    // Immediately drop the previous round's proof/result before the request.
    setProof(null);
    setResult(null);
    setResultMatches(null);
    setPayloadMatches(null);
    try {
      const response = await fetchVerification(slug, numericRound);
      if (!aliveRef.current || token !== loadTokenRef.current) return;
      setProof(response);
      const nextForm = formFromProof(response);
      setForm(nextForm);
      if (!response.vrfSignatureHex || !response.vrfPublicKey) {
        setError(t('verify.noProof'));
        return;
      }
      run(nextForm, response);
    } catch {
      if (!aliveRef.current || token !== loadTokenRef.current) return;
      setProof(null);
      setError(t('errors.api'));
    } finally {
      if (aliveRef.current && token === loadTokenRef.current) setLoadingProof(false);
    }
  };

  /** Apply a directly typed round id (Enter in the numeric input or Load proof). */
  const applyRound = (): void => {
    const raw = typedRound.trim().length > 0 ? typedRound : roundId;
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isFinite(numeric) || numeric < 1) {
      setError(t('verify.errorInvalid'));
      return;
    }
    const next = String(numeric);
    setTypedRound('');
    if (next === roundId) void loadProof(numeric);
    else setRoundId(next);
  };

  const refreshRounds = (): void => {
    history.refresh();
    active.refresh();
  };

  // Auto-load: choosing a round immediately fetches and verifies its proof, so a
  // finished round can never look "empty" just because the button was not pressed.
  useEffect(() => {
    if (roundId === '') return;
    const numeric = Number.parseInt(roundId, 10);
    if (!Number.isFinite(numeric) || numeric < 1) return;
    void loadProof(numeric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const update = (key: keyof FormState, value: string): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setResultMatches(null);
    setPayloadMatches(null);
  };

  const verified =
    result !== null &&
    result.signatureValid &&
    payloadMatches !== false &&
    resultMatches !== false;

  const selectedRound = rounds.find((round) => String(round.roundId) === roundId) ?? null;
  const selectedPending =
    selectedRound !== null && selectedRound.status !== null && !isVerifiableRoundStatus(selectedRound.status);
  const noRounds = rounds.length === 0 && history.data !== null && active.data !== null;

  // Zero-round startup: a clean Liquid Glass waiting card instead of an empty
  // selector / error while the Admin has not launched Round #1 yet.
  if (pendingRound && (history.data?.items.length ?? 0) === 0) {
    return (
      <div className="space-y-4">
        <WaitingForRoundCard gameLabel={gameType} onRefresh={refreshRounds} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="glass min-w-0 overflow-hidden p-4 sm:p-5">
        <div className="grid min-w-0 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
          <div className="min-w-0">
            <div className="stat-label mb-1">{t('verify.selectGame')}</div>
            <div className="segmented max-w-full">
              {(['BALL', '100K'] as const).map((game) => (
                <button
                  key={game}
                  type="button"
                  className={cn('segment', gameType === game && 'segment-active')}
                  aria-pressed={gameType === game}
                  onClick={() => {
                    // The parent remounts the workspace via `key={gameType}`.
                    if (game !== gameType) onGameChange(game);
                  }}
                >
                  {game}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <label className="stat-label mb-1 block" htmlFor="verify-round">
              {t('verify.selectRound')}
            </label>
            {/*
              Mobile: `select` + `#` input share one strict row and the Load
              proof button wraps below at full width. Desktop (`sm+`): all
              three sit side-by-side with explicit gap; the numeric input is
              `flex-1 min-w-0`, so it can never slide under the button.
            */}
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
              <div className="w-24 min-w-0 shrink-0 sm:w-52">
                <select
                  id="verify-round"
                  className="input select box-border w-full min-w-0"
                  value={roundId}
                  onChange={(event) => setRoundId(event.target.value)}
                >
                  <option value="">{t('verify.selectRound')}</option>
                  {rounds.map((round) => (
                    <option key={round.roundId} value={round.roundId}>
                      {roundOptionLabel(t, round)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="input box-border min-w-0 w-full flex-1 tabular"
                inputMode="numeric"
                pattern="[0-9]*"
                value={typedRound}
                onChange={(event) => setTypedRound(event.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyRound();
                  }
                }}
                placeholder="#"
                aria-label={t('verify.roundNumber')}
                title={t('verify.roundNumber')}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn-primary w-full shrink-0 whitespace-nowrap sm:w-auto"
                onClick={applyRound}
                disabled={loadingProof}
              >
                <Play size={16} strokeWidth={1.75} />
                {loadingProof ? t('verify.running') : t('verify.loadProof')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--text-muted)]">{t('verify.autoNote')}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refreshRounds} disabled={loadingProof}>
            <RefreshCw size={14} strokeWidth={1.75} />
            {t('common.refresh')}
          </button>
        </div>

        {selectedPending ? <p className="mt-2 text-xs text-[var(--warning)]">{t('verify.roundPending')}</p> : null}
        {noRounds ? <p className="mt-2 text-xs text-[var(--warning)]">{t('verify.noRounds')}</p> : null}
        {error !== null ? (
          <div className="glass-tile mt-2 px-3 py-2 text-sm text-[var(--text-primary)]" role="alert">
            {error}
          </div>
        ) : null}
        {history.error !== null && history.data === null && active.error !== null && active.data === null ? (
          <ErrorState body={t('errors.api')} onRetry={refreshRounds} className="mt-3" />
        ) : null}
      </section>

      <section className="glass min-w-0 overflow-hidden p-4 sm:p-5">
        <SectionHeader
          title={t('verify.manualTitle')}
          subtitle={t('verify.manualIntro')}
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => run(form, proof)} disabled={loadingProof}>
              <ShieldCheck size={15} strokeWidth={1.75} />
              {t('verify.runVerification')}
            </button>
          }
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('verify.drawAddress')} value={form.drawAddress} onChange={(value) => update('drawAddress', value)} />
          <Field
            label={t('verify.totalTickets')}
            value={form.totalTicketsSold}
            onChange={(value) => update('totalTicketsSold', value)}
          />
          <Field
            label={t('verify.closingMarker')}
            value={form.closingMarker}
            onChange={(value) => update('closingMarker', value)}
          />
          <Field
            label={t('verify.targetTime')}
            value={form.targetVrfTime}
            onChange={(value) => update('targetVrfTime', value)}
          />
          <Field label={t('verify.roundId')} value={form.roundId} onChange={(value) => update('roundId', value)} />
          <Field
            label={t('verify.publicKey')}
            value={form.publicKeyHex}
            onChange={(value) => update('publicKeyHex', value)}
          />
          <div className="sm:col-span-2">
            <Field
              label={t('verify.signature')}
              value={form.signatureHex}
              onChange={(value) => update('signatureHex', value)}
              mono
            />
          </div>
        </div>
      </section>

      {result ? (
        <section className="glass min-w-0 overflow-hidden p-4 sm:p-5">
          <SectionHeader
            title={t('verify.stepsTitle')}
            action={
              <span className={cn('pill', verified ? 'pill-success' : 'pill-danger')}>
                {verified ? <Check size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}
                {verified ? t('verify.verified') : t('verify.failed')}
              </span>
            }
          />

          <div className="space-y-2">
            <Step
              title={t('verify.stepPayload')}
              status={payloadMatches === false ? false : true}
              detail={
                payloadMatches === false
                  ? t('verify.payloadMismatch')
                  : payloadMatches === true
                    ? t('verify.payloadOk')
                    : result.payloadHex
              }
            />
            <Step
              title={t('verify.stepSignature')}
              status={result.signatureValid}
              detail={result.signatureValid ? t('verify.signatureOk') : t('verify.signatureBad')}
            />
            <Step title={t('verify.stepSeed')} status detail={`${t('verify.seedLabel')}: ${result.seedHex}`} />
            <Step
              title={t('verify.stepResult')}
              status={resultMatches === false ? false : resultMatches === true ? true : null}
              detail={
                resultMatches === false
                  ? t('verify.mismatch')
                  : resultMatches === true
                    ? t('verify.match')
                    : t('verify.noProof')
              }
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="glass-nested p-3">
              <div className="stat-label mb-1">{t('verify.payloadHash')}</div>
              <div className="code break-all text-xs text-[var(--text-primary)]">{result.payloadHex}</div>
              {proof ? (
                <a
                  className="link mt-2 inline-flex items-center gap-1 text-xs"
                  href={safeExternalUrl(proof.tonviewerUrl, tonviewerAddressUrl(proof.drawAddress))}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink size={13} strokeWidth={1.75} />
                  {t('common.viewExplorer')}
                </a>
              ) : null}
            </div>

            <div className="glass-nested p-3">
              <div className="stat-label mb-1">{t('verify.recomputedResult')}</div>
              {result.ball ? (
                <BallSet whites={result.ball.whites} red={result.ball.red} />
              ) : result.hundredK ? (
                <div className="text-xs text-secondary">
                  {result.hundredK.tickets.length} {t('common.winners')} ·{' '}
                  <span className="tabular">
                    {result.hundredK.tickets
                      .slice(0, 6)
                      .map((n) => `#${n.toString().padStart(6, '0')}`)
                      .join(' · ')}
                    …
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {result.hundredK ? (
            <div className="mt-4 overflow-x-auto no-scrollbar">
              <table className="data-table min-w-[420px]">
                <thead>
                  <tr>
                    <th>{t('verify.placeColumn')}</th>
                    <th>{t('verify.ticketColumn')}</th>
                    <th className="text-right">{t('verify.payoutColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.hundredK.tickets.map((number, index) => {
                    const onChain = proof?.winningResult?.winners?.find((winner) => winner.ticketNumber === number);
                    return (
                      <tr key={`${number}-${index}`}>
                        <td className="primary">#{placeForWinnerIndex(index)}</td>
                        <td>
                          <TicketNumberChip number={number} />
                        </td>
                        <td className="text-right">{onChain ? formatTonFromNano(onChain.payout) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {proof?.winningResult ? (
            <div className="glass-nested mt-3 p-3">
              <div className="stat-label mb-1">{t('verify.onChainResult')}</div>
              {proof.winningResult.kind === 'BALL' &&
              proof.winningResult.whites &&
              proof.winningResult.red !== undefined ? (
                <BallSet whites={proof.winningResult.whites} red={proof.winningResult.red} size="sm" />
              ) : proof.winningResult.tickets ? (
                <div className="flex flex-wrap gap-1.5 text-xs tabular">
                  {proof.winningResult.tickets.slice(0, 20).map((number, index) => (
                    <span key={`${number}-${index}`} className="pill pill-neutral">
                      #{number.toString().padStart(6, '0')}
                    </span>
                  ))}
                  {proof.winningResult.tickets.length > 20 ? <span>…</span> : null}
                </div>
              ) : null}
              <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-3">
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{t('ball.winnersTotal')}</span>
                  <span className="font-semibold tabular text-[var(--text-primary)]">{proof.winnerCount}</span>
                </div>
                {proof.rollover?.rolloverOut ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">{t('ball.rolloverOutLabel')}</span>
                    <span className="font-semibold tabular text-[var(--text-primary)]">
                      {proof.rollover.rolloverOut.ton} {t('common.ton')}
                    </span>
                  </div>
                ) : null}
                {proof.vrfSeedHex ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">{t('verify.seedLabel')}</span>
                    <span className="code truncate">{proof.vrfSeedHex.slice(0, 16)}…</span>
                  </div>
                ) : null}
              </div>
              {proof.winnerCount === 0 && proof.gameType === 'BALL' ? (
                <p className="mt-2 text-xs text-[var(--warning)]">
                  {t('ball.noWinners')} #{proof.roundId + 1}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <span className="stat-label mb-1 block">{label}</span>
      <input
        className={cn('input', mono && 'code')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
    </label>
  );
}

function Step({
  title,
  status,
  detail,
}: {
  title: string;
  status: boolean | null;
  detail?: string;
}): JSX.Element {
  return (
    <div className="glass-nested flex items-start gap-2.5 p-3">
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          status === true
            ? 'bg-[var(--success-soft)] text-[var(--success)]'
            : status === false
              ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
              : 'bg-[var(--fill-subtle)] text-[var(--text-muted)]',
        )}
      >
        {status === true ? (
          <Check size={14} strokeWidth={2} />
        ) : status === false ? (
          <X size={14} strokeWidth={2} />
        ) : (
          <Minus size={14} strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        {detail ? <div className="mt-0.5 break-all text-xs text-secondary">{detail}</div> : null}
      </div>
    </div>
  );
}

function compareResult(
  verification: VerificationResult,
  proof: VerifyResponse | null,
  gameType: GameType,
): boolean | null {
  if (!proof?.winningResult) return null;
  if (gameType === 'BALL') {
    const onChain = proof.winningResult;
    const computed = verification.ball;
    if (!computed || !onChain.whites || onChain.red === undefined) return null;
    return (
      computed.red === onChain.red &&
      computed.whites.length === onChain.whites.length &&
      computed.whites.every((white, index) => white === onChain.whites?.[index])
    );
  }
  const onChainTickets = proof.winningResult.tickets;
  const computed = verification.hundredK;
  if (!computed || !onChainTickets) return null;
  return (
    computed.tickets.length === onChainTickets.length &&
    computed.tickets.every((number, index) => number === onChainTickets[index])
  );
}

