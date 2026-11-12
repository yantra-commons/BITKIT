# Roadmap

## Good first issues

Small, well-scoped tasks for new contributors. Each needs tests and a docs/story update.

- [ ] **Translations:** add a `de` and `es` string table to the docs Localization page, and a
      `configure({ strings })` example in Storybook.
- [ ] **`ou-amount-display`:** add a `compact` option (e.g. "1.2M sats") using `Intl` compact
      notation on the integer part only.
- [ ] **`ou-network-badge`:** add a `size="sm"` variant.
- [ ] **`ou-copy-button`:** support copying rich text (`text/html`) alongside plain text.
- [ ] **Core:** `formatRelativeTime`: add tests for more locales (`hi-IN`, `ja-JP`).
- [ ] **Core:** expose `addressExplorerLinks(network)` for multiple explorers (mempool, blockstream).
- [ ] **Docs:** add a recipe for Svelte and one for Angular.
- [ ] **Storybook:** add a light/dark side-by-side decorator.
- [ ] **Examples:** add an Express version of `apps/examples/proxy` with a BTCPay webhook
      signature check.
- [ ] **Adapters:** add a `Strike` or `Zebedee` adapter following the BTCPay one (server-side).

## Next

- Per-component entry points for `@orange-ui/react` / `@orange-ui/vue` (smaller bundles).
- `ou-receive`: a reusable receive screen (address + invoice + amount request).
- BOLT12 offer creation support in adapters when providers expose it.
- PSBT review component (`ou-psbt-summary`) for hardware-wallet flows (display-only).
- Optional jsQR-based decoder package for camera scanning in Firefox/Safari.
- Visual regression tests for Storybook (Playwright screenshots).
- Lighthouse CI on the docs site.

## Milestone: agent payments (proposal, after 0.1)

Let people pay through their AI agents, and let sites accept payments from agents, without the
kit becoming custodial or responsible for enforcing spending limits.

### Principles

1. **The wallet enforces limits, not the agent and not this kit.** A prompt-injected agent will
   try to overspend. Budgets, per-payment caps and expiry must be enforced by the user's wallet
   (for example a restricted Nostr Wallet Connect connection). Our components only collect
   consent and display state.
2. **Still non-custodial.** No keys, no hosted agent, no MCP server that holds funds.
3. **Show the agent's reason, but don't trust it.** It is untrusted text. Display it, but never
   let it change the amount, the recipient or the approval button.
4. **Revocable and auditable.** The user can see every agent payment and revoke access in one
   click.

### Components and helpers

- [ ] **`<ou-agent-allowance>`:** sets up an agent's spending allowance: daily/weekly budget in
      sats, per-payment cap, expiry date, allowed methods. It requests a restricted connection
      from the user's wallet and emits `ou-allowance-created` with the connection for the app
      to hand to the agent. Like the security-sensitive components, the connection string is
      memory-only and never put in attributes, storage or logs.
- [ ] **`<ou-payment-approval>`:** a human-in-the-loop prompt for payments over the auto-approve
      threshold. It shows the decoded recipient and amount from `core` (not from agent-supplied
      text), the agent's stated reason clearly labelled as such, and the remaining budget. It
      fires `ou-approve` / `ou-reject`, and the approve button can't be clicked by script before
      the dialog is visible.
- [ ] **`<ou-agent-activity>`:** a list of agent payments (time, recipient, amount, reason,
      status) with budget-used progress and a "Revoke access" action (`ou-revoke`).
- [ ] **`@orange-ui/adapters/l402`:** helpers for HTTP 402 / L402: a server side that answers
      with an invoice plus token, and a client `fetchWithL402(url, { pay })` that pays through
      the user's wallet within a budget and retries the request. This lets sites sell API calls
      and content to agents.
- [ ] **Core:** `parseL402Challenge` / `buildL402Challenge`, with spec vectors.
- [ ] **Docs:** an "Agent payments" guide covering the threat model below, and an `llms-full.txt`
      section so agents know the L402 flow.

### Threat model (draft)

| Threat                                                | Mitigation                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Prompt injection makes the agent pay an attacker      | Wallet-enforced budget and per-payment cap; approval prompt above threshold; recipient shown from decoded invoice. |
| Agent misstates what a payment is for                 | Reason labelled as agent-supplied; amount and recipient come from `core` decoding.                                 |
| Connection string leaks (logs, storage, agent memory) | Memory-only in our components; short expiry by default; one-click revoke.                                          |
| Runaway loop of small payments                        | Rate/budget limits in the wallet; activity view highlights bursts.                                                 |
| Fake approval UI on a hostile page                    | Out of scope for a component library; document that approvals belong in the user's own app or wallet.              |

### Open questions (check before building)

- Which wallets enforce NWC budgets and expiry today, and is there a standard way for a web app
  to _request_ a restricted connection, or does each wallet do it differently? This decides
  `<ou-agent-allowance>`'s API.
- Current state of the L402 spec and existing client libraries: reuse rather than reimplement.
- Should approval also be possible from the wallet side (push to phone) instead of the app?

## Later

- RTL layout audit.
- Payjoin (BIP77/78) status display.
- Silent payments (BIP352) address display support.
