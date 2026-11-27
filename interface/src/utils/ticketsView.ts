import type { AppRoute } from '../types/game';

/**
 * Sub-view of the My Tickets tab.
 *
 * `Verify` is no longer a standalone dock slot: it lives inside My Tickets as a
 * segmented top switcher. `#/verify` is kept as a deep link so every existing
 * "Verify a draw" CTA (Overview, BALL, 100K, archive tables) still lands on the
 * verifier — it simply renders the My Tickets tab with Verify already open.
 */
export type TicketsView = 'tickets' | 'verify';

export function ticketsViewForRoute(route: AppRoute): TicketsView {
  return route === 'verify' ? 'verify' : 'tickets';
}
