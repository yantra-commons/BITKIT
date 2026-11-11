# Roadmap

## Good first issues

Small, well-scoped tasks for new contributors. Each needs tests and a docs/story update.

- [ ] **Translations:** add a `de` and `es` string table to the docs Localization page, and a
      `configure({ strings })` example in Storybook.
- [ ] **`bk-amount-display`:** add a `compact` option (e.g. "1.2M sats") using `Intl` compact
      notation on the integer part only.
- [ ] **`bk-network-badge`:** add a `size="sm"` variant.
- [ ] **`bk-copy-button`:** support copying rich text (`text/html`) alongside plain text.
- [ ] **Core:** `formatRelativeTime`: add tests for more locales (`hi-IN`, `ja-JP`).
- [ ] **Core:** expose `addressExplorerLinks(network)` for multiple explorers (mempool, blockstream).
- [ ] **Docs:** add a recipe for Svelte and one for Angular.
- [ ] **Storybook:** add a light/dark side-by-side decorator.
- [ ] **Examples:** add an Express version of `apps/examples/proxy` with a BTCPay webhook
      signature check.
- [ ] **Adapters:** add a `Strike` or `Zebedee` adapter following the BTCPay one (server-side).

## Next

- Per-component entry points for `@bitkit-ui/react` / `@bitkit-ui/vue` (smaller bundles).
- `bk-receive`: a reusable receive screen (address + invoice + amount request).
- BOLT12 offer creation support in adapters when providers expose it.
- PSBT review component (`bk-psbt-summary`) for hardware-wallet flows (display-only).
- Optional jsQR-based decoder package for camera scanning in Firefox/Safari.
- Visual regression tests for Storybook (Playwright screenshots).
- Lighthouse CI on the docs site.

## Later

- RTL layout audit.
- Payjoin (BIP77/78) status display.
- Silent payments (BIP352) address display support.
