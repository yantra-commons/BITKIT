# CLAUDE.md — conventions for bitkit-ui

Read `docs/PLAN.md` for architecture and `docs/DECISIONS.md` for open choices.

## Commands (run from repo root)

- `pnpm install` — install (pnpm 10+, Node 22+)
- `pnpm build` — turbo build of all packages/apps
- `pnpm test` — unit tests (Vitest) for all packages
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- `pnpm e2e` — Playwright (needs `pnpm exec playwright install`)
- `pnpm --filter @bitkit-ui/website dev` — docs site
- `pnpm --filter @bitkit-ui/elements storybook` — Storybook

Every phase ends with build + lint + typecheck + test green, then a commit.

## Hard rules

1. **No floating-point money.** Amounts are `bigint` msat in `core`. Never `parseFloat`,
   `Number()`, `toFixed` or `Math.*` on amounts. Fiat rates are exact decimal strings → rationals.
2. **No secrets on the network.** Mnemonic/seed components are memory-only, never fetch, never
   write to storage, no clipboard by default. Adapters never require secret API keys in the browser.
3. **`core` is pure.** No DOM, no `window`, no I/O. Everything there gets tests (95% coverage).
4. **SSR-safe.** No `window`/`document`/`customElements` at module top level. Register via
   `define()` from `elements/src/internal/define.ts`.
5. **No hard-coded colors** in components — only `var(--bk-*)` tokens from `@bitkit-ui/tokens`.
6. **Every runtime dependency is justified** in `docs/PLAN.md` §3.

## Component conventions (`packages/elements`)

- One folder per component: `src/components/<name>/<name>.ts`, `<name>.stories.ts`,
  `<name>.test.ts`. Tag = `bk-<name>`, class = `Bk<PascalName>`.
- No decorators: use `static override properties = {...}` and `declare` typed fields, set
  defaults in the constructor.
- Events: `bk-<verb>` (e.g. `bk-change`, `bk-paid`), `CustomEvent<Detail>`, `bubbles: true,
composed: true`. Document with JSDoc `@fires` so the manifest picks it up.
- Document `@csspart`, `@slot`, `@cssprop`, `@summary` in the class JSDoc.
- Each component handles loading / error / empty states and respects `prefers-reduced-motion`.
- Accessibility: visible focus ring (`--bk-focus-ring`), labels on every control, amounts and
  addresses get screen-reader-friendly `aria-label`s (see `core` `formatForScreenReader`).
- User-facing copy follows Bitcoin Design Guide terminology ("bitcoin" lowercase for the unit,
  "sats", "Lightning invoice", "on-chain").

## Style

- TypeScript strict, ESM only, `.js` extensions in relative imports.
- Prettier defaults + `singleQuote`, `printWidth: 100`.
- Tests next to source (`*.test.ts`).
- Commit messages: `phase N: <summary>` for phase commits, conventional style otherwise.
- Changesets for any published package change (`pnpm changeset`).
