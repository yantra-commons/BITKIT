# Security policy

## Reporting a vulnerability

**Please do not open public issues for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/yantra-commons/BITKIT/security/advisories/new).
Include affected packages and versions, a description, and reproduction steps.

- We acknowledge reports within **72 hours** and send an initial assessment within **7 days**.
- We coordinate a fix and disclosure date with you. We aim to release fixes for high-severity
  issues within 14 days.
- With your permission, we credit reporters in the advisory and changelog.

Supported versions: the latest minor release of each `@orange-ui/*` package.

## Scope

Especially in scope:

- Any way a recovery phrase, NWC connection string or provider API key could leak from a
  component (DOM, attributes, events, storage, network, clipboard, logs).
- Address, invoice or BIP21 parsing that accepts invalid input as valid, or misreports network,
  amount or destination.
- Floating-point or rounding errors in amount math.
- XSS through component rendering of untrusted data (descriptions, labels, LNURL metadata).
- Adapters sending data to unintended hosts.

## Threat model

### What the kit guarantees

1. **No private keys.** No component requests, derives, stores or transmits private keys.
2. **Recovery phrases are memory-only.** `ou-mnemonic-display`, `ou-mnemonic-input` and
   `ou-backup-check` accept words only via JavaScript properties (never attributes), don't render
   hidden words into the DOM, never put words in events, block copy by default, auto-hide on
   `visibilitychange` and after a timeout, disable autocomplete/spellcheck/password managers,
   and expose `clear()`. JavaScript strings are immutable, so memory can't be zeroed. We drop
   references only.
3. **No secret keys in browsers.** Adapters needing provider secrets throw when given a key in a
   browser context (override: `dangerouslyAllowBrowserKey`). The documented pattern is a server
   proxy with allow-listed routes (`apps/examples/proxy`).
4. **Exact amounts.** All money math uses `bigint` millisatoshis; lint rules forbid float parsing
   in the units module.
5. **Untrusted text is escaped.** Components render through Lit templates (auto-escaping). The
   only `unsafeSVG` use is the build-time-generated icon set.

### What it does not protect against

- **Compromised host page.** Any script running on the page (XSS, malicious dependency,
  extension) can read component memory. Use a strict Content Security Policy and isolate
  seed-handling screens.
- **Signature forgery.** BOLT11/BOLT12 decoding is display-level; signatures are not verified.
  Wallets and providers must verify before paying.
- **Malicious address substitution** by malware on the user's device. The kit aids visual
  verification (chunked display, QR) but can't detect a valid-but-wrong address.
- **Payment confirmation in the browser.** `ou-paid` is a UI signal. Fulfil orders from your
  server's verified provider webhook.
- **Third-party services you enable**: mempool.space (fee/price data) and LNURL domains
  (`fetch-metadata`). Both are opt-in or configurable.

### Mock adapter

Demo invoices carry zero signatures (unpayable), on-chain demo addresses default to signet, and
the checkout labels them "Demo payment — do not send real bitcoin".

## Review log

| Date       | Scope                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12 | Pre-release review of mnemonic components, adapters' secret handling, rendering of untrusted strings and URLs | **Fixed:** `ou-checkout` used an adapter-supplied `onchain.uri` as a link `href` verbatim, so a compromised backend could inject `javascript:` URLs. Now only `bitcoin:` URIs are accepted (regression test added). Verified: words never appear in serialized DOM or event payloads (tests); NWC secret cleared from the input on submit; Lit auto-escapes all text; `unsafeSVG` only renders the build-time icon set. No issues outstanding. |
