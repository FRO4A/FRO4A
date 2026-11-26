# FRO4A Interface

Telegram Mini App + Web SPA for the FRO4A pari-mutuel lottery on TON.

## Stack

- React 18 + TypeScript (strict) + Vite 5
- Tailwind CSS + iOS 27 Liquid Glass CSS tokens (light / dark)
- `@tonconnect/ui-react`, `@ton/core`, `vite-plugin-node-polyfills`
- `@noble/curves` ed25519 + TON cell hashing for the in-browser verifier
- `@twa-dev/sdk` (optional, guarded when outside Telegram)
- Vitest

## Commands

```powershell
cd C:\FRO4A\interface
npm install
npm run dev
npx tsc --noEmit
npm test
npm run build
```

Copy `.env.example` to `.env` when running against a real API / TonAPI key.
All environment variables are optional; defaults target the local API and TON testnet.

## Localization (i18n)

Every locale is a hand-authored, explicit TypeScript module in
`src/i18n/locales/` typed as `TranslationDictionary` — no packed string blobs, no
positional tuple arrays, no condensed summaries. Each module is key-for-key
identical to `en.ts`, so TypeScript fails the build when a leaf key is missing.

- `src/i18n/languages.ts` registers the 25 target world languages with their
  native name, English exonym, short-code badge and writing direction (`ar`,
  `ur`, `fa` are `rtl`).
- `src/i18n/translator.ts` deep-merges a locale over English, so a runtime value
  can never be `undefined`.
- `src/i18n/I18nProvider.tsx` rebuilds `t` inside a context value that depends on
  `locale`, so switching a language re-renders the entire tree immediately — no
  reload — and also updates `<html lang>`, `<html dir>` and the tab title.
- `src/styles/index.css` ships international font fallbacks (`Noto Sans`,
  `Noto Sans Arabic`, `Noto Sans Devanagari`, `Noto Sans CJK SC`, …), RTL spacing
  rules and a taller line box for CJK / Indic / Arabic scripts.

### Current coverage

Fully translated and selectable: **en, ru, zh, hi, es, ar, fr, pt, de**.

The other 16 registered languages (`bn, ur, id, ja, pcm, mr, te, tr, ta, yue, vi,
tl, wuu, ko, fa, ha`) already appear in the language picker with their full name
and badge but are disabled with a “coming soon” label. A language becomes
selectable as soon as its complete dictionary module is added to
`src/i18n/locales/`, `LOCALE_DICTIONARIES` and `SHIPPED_LOCALE_CODES`. This is
deliberate: switching into a partially translated dictionary is exactly what
produces the “half of the UI stays English” bug, so the app never does it.

### i18n tests

`src/__tests__/i18n.test.ts` asserts: 25 registry entries with unique codes and
badges, RTL flags for `ar/ur/fa`, 100 % leaf-key coverage for every shipped
dictionary, zero `U+FFFD`/mojibake characters, no English copy left inside a
translation, at least 35 % of the English length for every source string longer
than 60 characters, exact `{placeholder}` parity and list-length parity.

## Privacy invariants

- The FRO4A backend is a read-only public blockchain mirror: no accounts, cookies,
  Telegram IDs, analytics or IP logs.
- `GET /api/chain/tickets/:walletAddress` carries the connected PUBLIC wallet only
  to return its already-public on-chain ticket list; it is never logged or profiled.
- My Tickets and UserQuota load from that mirror first; direct public TON APIs are
  only an automatic fallback.
- No cookies and no localStorage identity. Only `fro4a_lang` and `fro4a_theme` are
  stored in `sessionStorage`.

## Verified opcodes (from `shared/wrappers` / Tact sources)

| Operation | BALL | 100K |
| --- | --- | --- |
| BuyTicket | `0x1001` + queryId + packedCombination | `0x1001` + queryId |
| ForceStartGame | `0x2001` + queryId | `0x2001` |
| CheckDeadline | `0x2002` + queryId | `0x2002` |
| SweepCompanyFee | `0x2005` + queryId + coins | `0x2005` |
| CheckVrfTimeout | `0x2006` + queryId | `0x2006` |
| RetryRollover | `0x2007` + queryId | — |
| CloseExpiredDraw | `0x2008` + queryId | `0x2008` |
| DeployDraw (factory) | `0x4001` + queryId + roundId | — |
| CreateDraw (factory) | — | `0x2007` + queryId |
| Ticket Claim | `0x3008` + queryId | `0x3011` |
| Ticket Refund | `0x3009` + queryId | `0x3012` |

BALL VRF payload uses a 32-bit `targetVrfTime`; 100K uses 64-bit. The 100K Feistel
permutation uses `roundId` as the key domain, matching the Tact contract exactly.

## Development utilities

- `scripts/reference-vectors.mjs` — independent contract-math reference vectors.
- `scripts/verify-quota-address.mjs` — checks the deterministic UserQuota address
  against the on-chain `getUserQuotaAddress` getter for both games.
