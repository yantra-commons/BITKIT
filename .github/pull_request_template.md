## What and why

<!-- What does this change, and why? Link issues: Fixes #123 -->

## Checklist

- [ ] `pnpm check` passes (format, build, lint, typecheck, unit tests)
- [ ] Tests added or updated (behavior + axe for components; spec vectors for core)
- [ ] Changeset added (`pnpm changeset`) if a published package changed

### Components

- [ ] Keyboard: every interaction works without a mouse; focus is visible and managed
- [ ] Screen reader: labels, roles and live announcements checked (VoiceOver/NVDA if possible)
- [ ] Light **and** dark theme checked; no hard-coded colors (tokens only)
- [ ] `prefers-reduced-motion` respected
- [ ] Story and docs example updated

### Money & security

- [ ] No floating-point amount math
- [ ] No secrets (keys, seeds, NWC strings, API keys) in attributes, events, logs, storage or network
- [ ] Untrusted data (adapter responses, invoices, LNURL metadata) is never used unvalidated in URLs or HTML
