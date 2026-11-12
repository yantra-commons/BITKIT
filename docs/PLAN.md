# orange-ui — Build Plan

> Working name `orange-ui`, npm scope `@orange-ui/*`. The name lives in `kit.config.json`;
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
  @orange-ui/react ──┐   @orange-ui/vue ──┐       (thin typed wrappers, generated from
                     ▼                    ▼        custom-elements.json)
              @orange-ui/elements  (Lit web components, Shadow DOM, ::part, tokens)
                 │            │
                 ▼            ▼
      @orange-ui/core    @orange-ui/tokens          @orange-ui/adapters
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

- Components extend a shared `OrangeElement` (LitElement) that adopts token styles.
- No `window`/`document`/`customElements` access at module top level. Registration is done by
  a `define()` helper that no-ops when `customElements` is undefined (SSR) or already defined.
- Each component lives at `@orange-ui/elements/<name>` (subpath export) and registers itself on
  import; `@orange-ui/elements` re-exports all. `sideEffects` lists only the registration
  entry files so bundlers tree-shake everything else.
- CDN build: a single self-contained ESM file `dist/cdn/orange-ui.js` (Lit + deps inlined) for
  `<script type="module" src="https://cdn.jsdelivr.net/npm/@orange-ui/elements/dist/cdn/orange-ui.js">`.

### Money

All amounts are `bigint` **millisatoshis** internally in `core` (Lightning needs msat
precision), exposed as sats via helpers. Fiat is handled as a rate expressed as an exact
decimal string → rational `{ num: bigint, den: bigint }` so conversion never uses floats.
Lint rule bans `parseFloat`/`Number(...)` on amount paths inside `core/src/units`.

## 3. Packages and runtime dependencies

| Package    | Runtime deps    | Justification                                                                                                                                                                                                     |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`     | `@scure/base`   | Audited bech32/bech32m/base58/base58check codecs (paulmillr, zero deps). Needed for address validation, BOLT11, LNURL.                                                                                            |
| `core`     | `@noble/hashes` | Audited sha256 (base58check checksum, BIP39 checksum). Already a dependency of `@scure/base`'s ecosystem.                                                                                                         |
| `core`     | `@scure/bip39`  | Audited English wordlist + checksum validation. Only the wordlist + `validateMnemonic` are used; no key derivation anywhere in UI paths.                                                                          |
| `tokens`   | —               | Build-time node script, no deps.                                                                                                                                                                                  |
| `elements` | `lit`           | Web component base (≈6 kB gz).                                                                                                                                                                                    |
| `elements` | `uqr`           | Tiny zero-dep QR encoder → SVG (unjs, MIT). Runs fully client side.                                                                                                                                               |
| `adapters` | —               | Uses `fetch`/`WebSocket`. NWC crypto (NIP-04/44) is delegated to a user-supplied signer or `@getalby/sdk` peer (optional peer, not bundled).                                                                      |
| `react`    | —               | Own ~80-line wrapper (`wrap.ts`): sets DOM properties via ref + layout effect and maps events to `on*` props. `@lit/react` 1.0.8 was evaluated and dropped: it failed to pass properties under React 19 in tests. |
| `vue`      | —               | Vue natively supports custom elements; wrappers are `defineComponent` shims for typing.                                                                                                                           |

Not added: a BOLT11 library (we implement a display-level decoder on `@scure/base` — ~200 LOC,
tested against BOLT11 spec vectors), a QR _scanning_ library (we use the native
`BarcodeDetector` where present and fall back to paste/upload; a `decoder` hook lets apps plug
in `jsQR`/`zxing` if they need Safari/Firefox camera scanning).

Dev tooling: TypeScript 6.0, ESLint 10 + typescript-eslint, Prettier, Vitest (+ happy-dom,
fast-check, coverage-v8), axe-core, Playwright, Storybook 10 (web-components-vite),
Custom Elements Manifest analyzer, Changesets, Turborepo, size-limit.

## 4. Component list

**Primitives:** `ou-button`, `ou-icon-button`, `ou-input`, `ou-select`, `ou-dialog`,
`ou-tooltip`, `ou-toast`, `ou-tabs`, `ou-badge`, `ou-spinner`, `ou-skeleton`, `ou-copy-button`,
`ou-qr-code`, `ou-icon`.

**Amounts:** `ou-amount-display`, `ou-amount-input`.

**Addresses:** `ou-address-display`, `ou-address-input`, `ou-qr-scanner`, `ou-network-badge`.

**Payments:** `ou-pay-button`, `ou-checkout`, `ou-invoice-display`, `ou-payment-status`,
`ou-donation-widget`, `ou-lightning-address-card`.

**Wallet & transactions:** `ou-wallet-connect`, `ou-balance-card`, `ou-transaction-list`,
`ou-transaction-item`, `ou-confirmation-progress`, `ou-fee-selector`, `ou-utxo-list`.

**Security-sensitive:** `ou-mnemonic-display`, `ou-mnemonic-input`, `ou-backup-check`.

Element prefix `ou-` (short, configurable through `kit.config.json` → `elementPrefix`).

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
| Name collision: "Bitkit" is an existing Bitcoin wallet (Synonym).              | Resolved: renamed to Orange UI (`@orange-ui/*`, `ou-` prefix) on 2026-11-13.                                                                                        |
| Bleeding-edge toolchain (TS 6, Vite 8, Astro 7, Storybook 10).                 | Pin versions; keep configs minimal; no decorators (Lit `static properties`) so we don't depend on decorator compile modes.                                          |
| happy-dom gaps for Shadow DOM / axe.                                           | Run contrast + real-browser checks in Playwright; keep happy-dom tests behavioural.                                                                                 |
| Secret-handling components misused.                                            | Memory-only, no network, no clipboard by default, `autocomplete=off`, `spellcheck=false`, explicit `clear()`; SECURITY.md threat model; review in phase 8.          |
| Adapters needing API keys in the browser.                                      | Adapter constructors accept a `baseUrl` to a server proxy; example proxy in `apps/examples/proxy`. BTCPay/OpenNode/LNbits admin keys are documented as server-only. |
| NWC requires NIP-04/44 crypto.                                                 | Adapter takes a pluggable `NwcClient` (e.g. `@getalby/sdk`) instead of shipping crypto ourselves; `ou-wallet-connect` delegates to Bitcoin Connect when present.    |
| QR scanning support varies (BarcodeDetector absent in Firefox/Safari desktop). | Graceful fallback to paste + image upload; pluggable decoder.                                                                                                       |
| OneDrive-synced working dir slows `node_modules`.                              | Documented; CI is the source of truth.                                                                                                                              |
