/**
 * Zero-round startup detection.
 *
 * Before the Admin launches Round #1 the backend answers HTTP 200 with
 * `{ pending: true, waiting: true, drawAddress: null }`. The UI must render the
 * Liquid Glass "Waiting for the next round" card instead of an error / spinner.
 */
export interface RoundLike {
  drawAddress?: string | null;
  pending?: boolean;
  waiting?: boolean;
}

export function isPendingRound(view: RoundLike | null | undefined): boolean {
  if (view === null || view === undefined) return false;
  if (view.pending === true || view.waiting === true) return true;
  return typeof view.drawAddress !== 'string' || view.drawAddress.trim().length === 0;
}
