# FRO4A Interface — Technical & UX Specification (C:\FRO4A\interface)

## 1. Overview & Architecture
FRO4A is a decentralized, Wallet-First, mathematically closed Pari-Mutuel Web3 lottery on TON (native TON only, zero registration, zero referrals, zero buyer data on server, Soulbound NFT tickets, ed25519 VRF verifiable fairness).

Build `C:\FRO4A\interface` as a production-ready Telegram Mini App + Web SPA using:
- Core: React 18+, TypeScript (strict), Vite
- Styling: Tailwind CSS + custom CSS variables for iOS 27 Liquid Glass Light/Dark tokens
- Icons: `lucide-react` (clean `strokeWidth={1.75}`)
- TON: `@tonconnect/ui-react`, `@ton/core`, `vite-plugin-node-polyfills`
- Crypto (In-Browser Verifier): `@noble/curves` (ed25519) or `@noble/ed25519` + `@ton/core` (SHA-256 / Cell hashing)
- Telegram: `@twa-dev/sdk` (defensive fallback when running in regular browsers outside Telegram)
- Testing: Vitest

---

## 2. Design System — iOS 27 Liquid Glass (Light & Dark, Zero Neon)

### 2.1 Visual Philosophy
The interface must look and feel like a native Apple iOS 27 financial/protocol app (Apple Wallet / Apple Health / iOS Control Center): luminous frosted translucent glass surfaces floating over a calm atmospheric canvas, subtle depth, crisp 1px specular hairline borders, calm typography, and complete data transparency.

STRICTLY FORBIDDEN:
- Neon glows (`box-shadow` or `text-shadow` glow in cyan/purple/pink/green)
- Cyberpunk gradients, laser borders, or animated rainbow effects
- Pitch-black `#000000` backgrounds with loud neon highlights
- Generic "crypto casino" flashing badges or cluttered UI

### 2.2 Color & Glass Tokens (`html[data-theme="light" | "dark"]`)
Monochrome Alpine edition: the interface is strictly monochrome/metallic Liquid Glass. Blue, cyan, sky, neon and rainbow gradients are forbidden. Only the single ruby BALL powerball may keep a muted deep ruby tone.

Light Mode:
- Canvas base: `#EEF1F5` behind a local bright misty alpine ridge (`public/alpine-light.svg`) with pale sunlit limestone peaks.
- Primary glass surface: `rgba(255, 255, 255, 0.74)`, `backdrop-filter: blur(24px) saturate(140%)`
- Secondary nested glass surface: `rgba(255, 255, 255, 0.52)`, `backdrop-filter: blur(16px) saturate(130%)`
- Specular border & shadow: `1px solid rgba(255, 255, 255, 0.9)`, `box-shadow: inset 1px 1px 0 rgba(255,255,255,0.95), inset -1px -1px 0 rgba(15,23,42,0.04), 0 8px 30px rgba(15, 23, 42, 0.07)`
- Text: Primary `#0F172A`, Secondary `#475569`, Muted `#64748B`
- Primary CTA pill: `#111827` background with `#FFFFFF` text
- Semantic status surfaces: monochrome glass tints; ruby powerball `#8F1D2C`

Dark Mode:
- Canvas base: `#0B0D11` behind a local moody charcoal/obsidian alpine ridge (`public/alpine-dark.svg`) with atmospheric mist.
- Primary glass surface: `rgba(22, 24, 29, 0.54)`, `backdrop-filter: blur(24px) saturate(140%)`
- Secondary nested glass surface: `rgba(255, 255, 255, 0.055)`, `backdrop-filter: blur(16px) saturate(130%)`
- Specular border & shadow: `1px solid rgba(255, 255, 255, 0.10)`, `box-shadow: inset 1px 1px 0 rgba(255,255,255,0.14), inset -1px -1px 0 rgba(255,255,255,0.06), 0 14px 36px rgba(0, 0, 0, 0.38)`
- Text: Primary `#F8FAFC`, Secondary `#9CA3AF`, Muted `#6B7280`
- Primary CTA pill: frosted ivory `#F3F4F6` background with `#111827` text
- Semantic status surfaces: monochrome glass tints; ruby powerball `#9F2434`

### 2.3 Theme Switcher, Typography & Layout
- Theme Switcher: Sun/Moon floating Liquid Glass circle in the top bar. Persists strictly in `sessionStorage` (`fro4a_theme`). Defaults to system preference (`prefers-color-scheme`) when unset.
- Typography: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif`. Apply `font-variant-numeric: tabular-nums` to all TON values, countdown timers, percentages, ball numbers, and ticket counters.
- Radii: `24px` main cards, `16px` nested cards/inputs/metric tiles, `9999px` segmented controls, dock and pill buttons.
- Background: one fixed full-viewport mountain layer (`fixed inset-0 -z-10 pointer-events-none`) that crossfades with the theme. No solid header strip, no header divider, no footer bar.
- Navigation: the top bar is a single compact, horizontally centred Liquid Glass cluster — Sun/Moon theme circle, the `FRO4A` wordmark, and the globe language circle — with >= `92px` horizontal safe padding and `env(safe-area-inset-top)` / Telegram `safeAreaInset.top` clearance so it can never collide with Telegram's native fullscreen `× Close` / `⌄ …` pills. The wallet is NOT in the top bar. Primary navigation lives in a centred floating Liquid Glass bottom dock (`Overview`, `Games`, `My Tickets`, `Wallet`) that respects `env(safe-area-inset-bottom)`. Main scroll areas keep `pb-28` so the dock never obscures content.

---

## 3. Internationalization (i18n)
- Default language: English (`en`).
- Initial locales: English (`en`) and Russian (`ru`).
- Extensible architecture:
  - Strict `TranslationDictionary` TypeScript interface in `src/i18n/types.ts`.
  - Locale modules in `src/i18n/locales/en.ts` and `src/i18n/locales/ru.ts`.
  - Single `SUPPORTED_LOCALES` registry in `src/i18n/index.ts` so adding future languages requires only adding one locale file + one registry entry.
- UI Control: compact `RU` / `EN` Liquid Glass toggle pill in the top bar (`sessionStorage`-backed).
- Persistence: Strictly `sessionStorage` (`fro4a_lang`). Zero cookies, zero backend storage. Automatically clears when the tab or Mini App closes.

---

## 4. SPA Navigation & Persistent Wallet Connection
- Root `App.tsx` hierarchy: `<TonConnectUIProvider manifestUrl={...}>` -> `<ThemeProvider>` -> `<I18nProvider>` -> `<AppShell>`.
- Pure client-side SPA routing (React state or HashRouter) — NEVER trigger full-page reloads so TON Connect never disconnects between screens.
- Top-Level Views:
  1. Overview (Home, default): editorial headline, compact protocol bento glass tiles, live BALL and 100K summary cards with individual metric tiles, and a scrollable `Game rules` section with `BALL | 100K` glass tabs covering mechanics, prize distribution, VRF fairness, 24h cancellation/refund rules, pricing, timers, privacy and verified contracts.
  2. Games hub (`#/games`): a floating Liquid Glass segmented switcher (`BALL` | `100K`) above the selected game. Deep links `#/ball` and `#/100k` open the same hub on the requested game.
  3. BALL Game: Live draw stats, exact 8-category prize breakdown (% + live TON amount), 30-day countdown + 10,000-ticket threshold progress bar, ticket picker (or Admin Panel for Admin), and BALL past rounds archive.
  4. 100K Game: Live draw stats, exact 6-tier 100-winner prize breakdown (% per tier, % per ticket, live TON amount), 30-day countdown + 10,000 threshold & 100,000 hard-cap progress, ticket purchase panel (or Admin Panel for Admin), and 100K past rounds archive.
  5. My Tickets: 100% client-side on-chain viewer for the connected wallet's Active and Past SBT tickets (BALL + 100K), Claim / Refund actions, and 60-day expiry countdown. A segmented Liquid Glass switcher at the very top of the screen toggles between `My Tickets` and `Verify` without leaving the tab (`My Tickets` stays the default sub-view).
  6. Verify (Fairness Verifier): In-browser ed25519 VRF signature verification and deterministic recalculation of BALL numbers and 100K 6-round Feistel winners. Rendered inside the My Tickets tab; `#/verify` deep links (and every "Verify a draw" CTA) open My Tickets with this sub-view already active.
- Always-Visible Top Bar: one centred, collision-free cluster `[Theme circle] [FRO4A wordmark] [Language globe]`, sized for the ~180px corridor Telegram leaves between its native fullscreen pills (`34–36px` circles, `gap-2`, compact tracking). No wallet control, no responsive `hidden` classes and no overflow clipping. On the `#/verify` deep link the `My Tickets` dock slot stays highlighted.
- Bottom Floating Dock: centred Liquid Glass capsule with `Overview`, `Games`, `My Tickets` (subtle ticket-count badge) and `Wallet`; active item gets an elevated glass highlight. The Wallet slot opens the TON Connect modal when disconnected, and a viewport-clamped Liquid Glass popover above the dock when connected (shortened address, admin/treasury role badge, network, Copy Address, Disconnect, subtle monochrome connected dot — no neon/blue/green).

---

## 5. Anonymous Backend API Integration
Configure base URL via `VITE_API_BASE_URL` (default `http://localhost:3000`).
Inspect `../server/src/` before coding to match exact response DTOs for:
- `GET /health`
- `GET /api/overview`
- `GET /api/games/:gameType/current` (`ball` | `100k`)
- `GET /api/games/ball/taken-combinations/:roundId`
- `GET /api/games/:gameType/history`
- `GET /api/chain/tickets/:walletAddress`
- `GET /api/verify/:gameType/:roundId`

HARD PRIVACY RULE: the backend is a read-only public blockchain mirror. It stores ONLY public on-chain data and keeps `logger: false`, `trustProxy: false`, no request-URL logs, no cookies, no accounts, no Telegram IDs and no analytics. `GET /api/chain/tickets/:walletAddress` is the single allowed address-bearing call: it receives the connected PUBLIC wallet only to return that wallet's already-public ticket list. Never combine it with an IP or use it as a profile.

---

## 6. Dynamic Role-Based Interface (Buyer vs Admin vs Treasury)
Read `adminAddress` from `/api/games/:gameType/current` (fallback to `../shared/deployments/testnet.json`) and `treasuryAddress` from `../shared/deployments/testnet.json`.
ALWAYS compare TON addresses with `Address.parse(walletAddress).equals(Address.parse(targetAddress))` so `0Q`, `EQ`, `UQ`, and `kQ` formats match reliably.

### 6.1 Buyer Mode (wallet != admin && wallet != treasury)
- On-Chain Wallet Quota: read `X / 100` from `GET /api/chain/tickets/:walletAddress` (instant). Fall back to the on-chain `UserQuota` getter only if that request fails. Disable purchase if `X >= 100`.
- BALL Ticket Picker:
  - Glass number grid for 5 unique white balls (`1..69`, sorted ascending) + 1 red ball (`1..26`).
  - "Quick Pick" (generates a valid random combination avoiding known taken combinations) and "Clear" buttons.
  - Real-time duplicate check against `/api/games/ball/taken-combinations/:roundId` polled every 3s and stored in a client `Set`: the 5+1 selection is checked instantly (0ms) with no per-click TonAPI call. Hard-disable Add/Buy when taken; re-check once (<50ms) right before opening Tonkeeper.
  - Dynamic cost breakdown before signing: `ticketBody (pool) + companyFee (10% non-refundable) + gas buffer (unused gas returned) = minBuyValue` (read dynamically from API/contract, never hardcoded).
  - "Buy Ticket" sends `BuyTicket` (`0x1001`) directly to the active `BallDrawInstance` using exact TL-B payload verified against `../shared/wrappers/ball/`.
- 100K Ticket Purchase:
  - Shows current sold count (`N / 100,000`), sequential numbering (`#1..#100000`), remaining quota (`X / 100`), and dynamic cost breakdown (`ticketBody + companyFee + gas buffer = minBuyValue`).
  - "Buy Ticket" sends `BuyTicket` (`0x1001`) directly to the active `Draw100kInstance` using exact TL-B payload verified against `../shared/wrappers/100k/`.
- Draw Status Guarding: Disable buying when draw `status` is not `0 (WAITING_FIRST_TICKET)` or `1 (ACTIVE_SALES)` and display a clear status banner (`SALES_CLOSED`, `TALLYING`, `CLAIM_OPEN`, `CANCELLED`).

### 6.2 Admin Mode (wallet == admin)
- Hide the buyer ticket picker / quantity selector / "Buy Ticket" button completely.
- In the primary action card slot render a prominent one-click "Force Start Game" / "Принудительный запуск игры" Liquid Glass button: clicking it immediately opens Tonkeeper to sign `ForceStartGame` (`0x2001`) to the active draw (the wallet is the confirmation step — no extra modal).
- Show a concise subtitle that Admin cannot buy tickets on-chain; disable the button when `status >= 2` and display the live phase (`SALES_CLOSED — Waiting for VRF`, `TALLYING`, `CLAIM_OPEN`, `CANCELLED`).
- Keep secondary operations below in a secondary glass section:
  1. Create New Round -> Factory contract:
     - 100K (`Draw100kFactory`): admin-only `CreateDraw` (verify exact opcode & payload in `../shared/wrappers/100k/`).
     - BALL (`BallFactory`): `DeployDraw` (`0x4001`, verify exact payload in `../shared/wrappers/ball/`).
  2. Sweep Company Fee (`SweepCompanyFee`, `0x2005`) -> Draw Instance.
  3. Collapsible Lifecycle Maintenance: `CheckDeadline` (`0x2002`), `CheckVrfTimeout` (`0x2006`), `RetryRollover` (`0x2007`, BALL only), `CloseExpiredDraw` (`0x2008`, after 60 days).

### 6.3 Treasury Mode (wallet == treasury)
- Disable "Buy Ticket" and display a clear notice that the Treasury address is restricted from purchasing tickets on-chain.

---

## 7. "My Tickets" — instant public mirror, on-chain fallback
Primary path: `GET /api/chain/tickets/:walletAddress` (server PostgreSQL read, warm `<50ms`, 3s short-lived snapshot) returns all active/past BALL & 100K tickets, statuses, payouts and exact active-round quotas. The browser must NOT block the first render on TonAPI.

Fallback ONLY when that endpoint fails: build `src/services/tonChain.ts` querying public TonAPI (`VITE_TONAPI_BASE_URL`, default `https://testnet.tonapi.io/v2`, optional `VITE_TONAPI_KEY`) directly from the browser:

1. Discover User's FRO4A SBT Tickets:
   - Gather known draw addresses from `/api/games/*/current`, `/api/games/*/history`, and `../shared/deployments/testnet.json`.
   - Query user's NFTs via TonAPI (`/accounts/{wallet}/nfts`) filtered by those draw collection addresses.
   - Parse TEP-64 metadata and/or run on-chain getters on each `TicketSBT` (verify exact getter names and stack layouts in `../shared/wrappers/ball/` and `../shared/wrappers/100k/`) to retrieve game type (`BALL` | `100K`), round ID, draw address, SBT address, ticket combination/number, and on-chain ticket status (`0=ACTIVE`, `1=PENDING`, `2=TALLIED`, `3=CLAIMED`, `4=REFUNDED`).
2. Enrich with Public Draw Data:
   - The mirror already joins draw status (`0..5`), winning numbers, category payouts and the 60-day expiration; the fallback matches each `drawAddress` to current/history draw state.
3. Display & User Actions:
   - Filter tabs: Active / Past and All / BALL / 100K.
   - Active (`status 0` or `1`): Ticket values + "Active — Waiting for Draw".
   - Closed / Tallying (`status 2` or `3`): "Draw in Progress / Counting Winners" (note that the Keeper auto-tallies BALL tickets during the 2-hour window).
   - Claim Open (`status 4`):
     - Winner: Matched category/tier + exact TON payout + "Claim Prize" button sending `Claim` (`0x3008`) to the `TicketSBT` address (disabled & badged "Claimed" if `ticket.status === 3`).
     - Non-winner: Clear side-by-side comparison against the winning balls/numbers.
   - Cancelled (`status 5`):
     - "Refund Ticket" button sending `Refund` (`0x3009`) to the `TicketSBT` address (disabled & badged "Refunded" if `ticket.status === 4`).
     - Clear explanation: returns ticket body only (`refundValue`), 10% company fee is non-refundable, buyer pays network gas (~0.05 TON).
   - 60-Day Window Countdown: Live remaining time before `CloseExpiredDraw` expires unclaimed funds.

---

## 8. In-Browser Fairness Verifier
Build `src/services/vrfVerifier.ts` and `src/pages/VerifierPage.tsx`:
- Select any completed BALL or 100K round (loads public proof from `GET /api/verify/:gameType/:roundId`) or paste parameters manually.
- Execute all cryptography and math locally in the browser:
  1. Reconstruct VRF payload cell: `sha256(Cell{0x56524631, drawAddress, totalTicketsSold, closingMarker, targetVrfTime})` matching exact bit widths and layout in `../shared/protocol-standard.md` and `../contracts/`.
  2. Verify the 512-bit ed25519 signature against the protocol VRF Public Key.
  3. Extract the first 256 bits of the signature as `seed`.
  4. Recompute winning result deterministically using the exact Tact contract logic from `../contracts/ball/` (5 white `1..69` + 1 red `1..26`) or `../contracts/100k/` (6-round Feistel permutation over `q x q` yielding 100 unique ticket numbers in `1..totalTicketsSold`).
  5. Compare recomputed result with on-chain result and display step-by-step verification status (`Payload Hash -> Signature Valid -> Seed Derived -> Result Match: VERIFIED`) with Tonviewer link.

---

## 9. Game Information & Protocol Transparency (Overview / Rules)
Write clear, structured documentation in both EN and RU (scrollable `Game rules` section at the bottom of the Overview screen + quick "Read the rules" links from BALL & 100K that return to `#/` and scroll to `#game-rules`):
- Core Protocol Principles: Wallet-First, 100% mathematically closed Pari-Mutuel pool, immutable contracts (no `set_code`, admin cannot withdraw prize funds), Soulbound NFT tickets (TEP-62 + TEP-85 + TEP-64), read-only public on-chain mirror with no personal data (no accounts, cookies, IP logs or analytics), ed25519 VRF.
- BALL Game Rules: 5 unique white balls (`1..69`) + 1 red ball (`1..26`), 292,201,338 combinations, full 8-category payout table (`Cat 8: 25% + 100% Rollover`, `Cat 7: 9%`, `Cat 6: 9%`, `Cat 5: 9%`, `Cat 4: 9%`, `Cat 3: 10%`, `Cat 2: 14%`, `Cat 1: 15%`), 4 zero-payout outcomes, 2-hour auto-tallying window, automatic rollover of empty categories to Round N+1.
- 100K Game Rules: Hard cap 100,000 tickets, 6-round Feistel fair selection of 100 unique winners across 6 tiers (`1st: 1 x 20%`, `2nd: 4 x 5%`, `3rd: 10 x 1.5%`, `4th: 15 x 0.866%`, `5th: 20 x 0.6%`, `6th: 50 x 0.4%`).
- Pricing, Limits & Timers: Dynamic price breakdown (pool body + 10% non-refundable fee + refundable gas buffer), 100 tickets/wallet/round quota, 30-day timer starting from 1st ticket, 10,000-ticket minimum threshold, cancellation & buyer-initiated refund rules, 30-second VRF + 24-hour VRF failure fallback, 60-day claim/refund window before `CloseExpiredDraw`.
- Verified Live Contracts: Addresses loaded from `../shared/deployments/testnet.json` with one-click copy and Tonviewer links.

---

## 10. Project Files & Verification
Create inside `C:\FRO4A\interface\`:
- `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `index.html`
- `.env.example` (`VITE_API_BASE_URL`, `VITE_NETWORK`, `VITE_TONAPI_BASE_URL`, `VITE_TONAPI_KEY`, `VITE_TONCONNECT_MANIFEST_URL`)
- `public/tonconnect-manifest.json`
- Modular `src/` (`components/`, `pages/`, `services/`, `hooks/`, `i18n/`, `styles/`, `utils/`, `types/`)
- Vitest suite in `src/__tests__/` covering:
  1. Address comparison & Admin/Treasury/Buyer role detection (`0Q` / `EQ` / `UQ` / `kQ`)
  2. Message payload builders & opcodes matching `../shared/wrappers/`
  3. In-browser BALL VRF derivation matching contract logic
  4. In-browser 100K 6-round Feistel permutation matching contract logic