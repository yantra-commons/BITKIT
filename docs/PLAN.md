# bitkit-ui — Build Plan

> Working name `bitkit-ui`, npm scope `@bitkit-ui/*`. The name lives in `kit.config.json`;
> `node scripts/rename.mjs <new-name>` rewrites every reference. See `docs/DECISIONS.md`.

## 1. Goal

The default set of UI components any Bitcoin web app drops in for amounts, addresses,
invoices, payments, wallets and transactions — framework-agnostic Web Components with
headless logic, thin React/Vue wrappers, a provider-agnostic payment adapter layer, and a
polished docs site.

## 2. Architecture

```
               ┌───────────────────────────── apps/website (Astro + Starlight)
               │                               apps/examples (vanilla, React, Vue, Next, proxy)
               ▼
  @bitkit-ui/react ──┐   @bitkit-ui/vue ──┐       (thin typed wrappers, generated from
                     ▼                    ▼        custom-elements.json)
              @bitkit-ui/elements  (Lit web components, Shadow DOM, ::part, tokens)
                 │            │
                 ▼            ▼
      @bitkit-ui/core    @bitkit-ui/tokens          @bitkit-ui/adapters
      (pure TS, no DOM)  (JSON → CSS vars + TS)     (PaymentAdapter, RateAdapter,
                                                     FeeAdapter; mock, BTCPay, LNbits,
                                                     NWC, OpenNode, generic polling)
```

Layering rules (enforced by package dependencies, not convention):

- `core` depends on nothing in the repo and never touches `window`/`document`.
- `tokens` has zero runtime dependencies.
- `adapters` depends on `core` only (types + amount math). No UI.
- `elements` depends on `core`, `tokens`, `lit`, `uqr`. It consumes adapters only through the
  `PaymentAdapter` / `FeeRateAdapter` / `FiatRateAdapter` **interfaces** (type-only import), so
  bundling a component never pulls in a vendor adapter.
- `react` / `vue` depend on `elements`.

### Rendering + SSR

- Components extend a shared `BitkitElement` (LitElement) that adopts token styles.
- No `window`/`document`/`customElements` access at module top level. Registration is done by
  a `define()` helper that no-ops when `customElements` is undefined (SSR) or already defined.
- Each component lives at `@bitkit-ui/elements/<name>` (subpath export) and registers itself on
  import; `@bitkit-ui/elements` re-exports all. `sideEffects` lists only the registration
  entry files so bundlers tree-shake everything else.
- CDN build: a single self-contained ESM file `dist/cdn/bitkit-ui.js` (Lit + deps inlined) for
  `<script type="module" src="https://cdn.jsdelivr.net/npm/@bitkit-ui/elements/dist/cdn/bitkit-ui.js">`.

### Money

All amounts are `bigint` **millisatoshis** internally in `core` (Lightning needs msat
precision), exposed as sats via helpers. Fiat is handled as a rate expressed as an exact
decimal string → rational `{ num: bigint, den: bigint }` so conversion never uses floats.
Lint rule bans `parseFloat`/`Number(...)` on amount paths inside `core/src/units`.

## 3. Packages and runtime dependencies

| Package    | Runtime deps    | Justification                                                                                                                                |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`     | `@scure/base`   | Audited bech32/bech32m/base58/base58check codecs (paulmillr, zero deps). Needed for address validation, BOLT11, LNURL.                       |
| `core`     | `@noble/hashes` | Audited sha256 (base58check checksum, BIP39 checksum). Already a dependency of `@scure/base`'s ecosystem.                                    |
| `core`     | `@scure/bip39`  | Audited English wordlist + checksum validation. Only the wordlist + `validateMnemonic` are used; no key derivation anywhere in UI paths.     |
| `tokens`   | —               | Build-time node script, no deps.                                                                                                             |
| `elements` | `lit`           | Web component base (≈6 kB gz).                                                                                                               |
| `elements` | `uqr`           | Tiny zero-dep QR encoder → SVG (unjs, MIT). Runs fully client side.                                                                          |
| `adapters` | —               | Uses `fetch`/`WebSocket`. NWC crypto (NIP-04/44) is delegated to a user-supplied signer or `@getalby/sdk` peer (optional peer, not bundled). |
| `react`    | `@lit/react`    | Official Lit → React wrapper, maps events to `onX` props.                                                                                    |
| `vue`      | —               | Vue natively supports custom elements; wrappers are `defineComponent` shims for typing.                                                      |

Not added: a BOLT11 library (we implement a display-level decoder on `@scure/base` — ~200 LOC,
tested against BOLT11 spec vectors), a QR _scanning_ library (we use the native
`BarcodeDetector` where present and fall back to paste/upload; a `decoder` hook lets apps plug
in `jsQR`/`zxing` if they need Safari/Firefox camera scanning).

Dev tooling: TypeScript 6.0, ESLint 10 + typescript-eslint, Prettier, Vitest (+ happy-dom,
fast-check, coverage-v8), axe-core, Playwright, Storybook 10 (web-components-vite),
Custom Elements Manifest analyzer, Changesets, Turborepo, size-limit.

## 4. Component list

**Primitives:** `bk-button`, `bk-icon-button`, `bk-input`, `bk-select`, `bk-dialog`,
`bk-tooltip`, `bk-toast`, `bk-tabs`, `bk-badge`, `bk-spinner`, `bk-skeleton`, `bk-copy-button`,
`bk-qr-code`, `bk-icon`.

**Amounts:** `bk-amount-display`, `bk-amount-input`.

**Addresses:** `bk-address-display`, `bk-address-input`, `bk-qr-scanner`, `bk-network-badge`.

**Payments:** `bk-pay-button`, `bk-checkout`, `bk-invoice-display`, `bk-payment-status`,
`bk-donation-widget`, `bk-lightning-address-card`.

**Wallet & transactions:** `bk-wallet-connect`, `bk-balance-card`, `bk-transaction-list`,
`bk-transaction-item`, `bk-confirmation-progress`, `bk-fee-selector`, `bk-utxo-list`.

**Security-sensitive:** `bk-mnemonic-display`, `bk-mnemonic-input`, `bk-backup-check`.

Element prefix `bk-` (short, configurable through `kit.config.json` → `elementPrefix`).

## 5. Phases

1. **Foundation** — monorepo, tooling, CI skeleton, tokens, `CLAUDE.md`, this plan.
2. **Core** — units, addresses, BIP21, BOLT11, LNURL, Lightning Address, BOLT12 detection,
   `parsePaymentInput`, fees, mnemonic helpers. Vectors from BIP-173/350/21 and BOLT-11.
3. **Primitives + amounts + addresses** — components, stories, unit + axe tests.
4. **Payments** — adapters (mock first), pay-button, checkout, status, invoice, donation,
   lightning-address-card.
5. **Wallet + transactions + fees + security-sensitive** components.
6. **React and Vue wrappers** generated from `custom-elements.json`; example apps.
7. **Website** — landing, docs, API pages, playground, theme builder, templates.
8. **Hardening** — a11y audit, bundle size, cross-browser Playwright, security review,
   README polish, release dry run.

Gate between phases: `pnpm build && pnpm lint && pnpm typecheck && pnpm test` green, then commit.

## 6. Testing strategy

- `core`: Vitest + fast-check, 95% coverage threshold enforced in config.
- `elements`: Vitest + happy-dom for behaviour (props, events, keyboard), axe-core run on every
  component's rendered shadow tree (color-contrast checked separately in Playwright).
- Playwright: e2e against the vanilla example + website (checkout flow on mock adapter), axe
  in real Chromium/Firefox/WebKit.
- Storybook: one story file per component, built in CI.

## 7. Risks

| Risk                                                                           | Mitigation                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name collision: "Bitkit" is an existing Bitcoin wallet (Synonym).              | Name is a placeholder; rename script; flagged in DECISIONS.md.                                                                                                      |
| Bleeding-edge toolchain (TS 6, Vite 8, Astro 7, Storybook 10).                 | Pin versions; keep configs minimal; no decorators (Lit `static properties`) so we don't depend on decorator compile modes.                                          |
| happy-dom gaps for Shadow DOM / axe.                                           | Run contrast + real-browser checks in Playwright; keep happy-dom tests behavioural.                                                                                 |
| Secret-handling components misused.                                            | Memory-only, no network, no clipboard by default, `autocomplete=off`, `spellcheck=false`, explicit `clear()`; SECURITY.md threat model; review in phase 8.          |
| Adapters needing API keys in the browser.                                      | Adapter constructors accept a `baseUrl` to a server proxy; example proxy in `apps/examples/proxy`. BTCPay/OpenNode/LNbits admin keys are documented as server-only. |
| NWC requires NIP-04/44 crypto.                                                 | Adapter takes a pluggable `NwcClient` (e.g. `@getalby/sdk`) instead of shipping crypto ourselves; `bk-wallet-connect` delegates to Bitcoin Connect when present.    |
| QR scanning support varies (BarcodeDetector absent in Firefox/Safari desktop). | Graceful fallback to paste + image upload; pluggable decoder.                                                                                                       |
| OneDrive-synced working dir slows `node_modules`.                              | Documented; CI is the source of truth.                                                                                                                              |
