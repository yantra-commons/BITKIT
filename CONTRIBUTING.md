# Contributing

Thanks for helping build the default UI kit for Bitcoin apps!

## Setup

```sh
pnpm install              # Node 22+, pnpm 10+
pnpm build && pnpm test   # should be green before you start
pnpm exec playwright install   # once, for e2e
```

| Task                           | Command                                             |
| ------------------------------ | --------------------------------------------------- |
| Everything CI runs             | `pnpm check` (format, build, lint, typecheck, test) |
| End-to-end + real-browser a11y | `pnpm e2e`                                          |
| Bundle-size budgets            | `pnpm size`                                         |
| Component workbench            | `pnpm storybook`                                    |
| Docs site                      | `pnpm --filter @bitkit-ui/website dev`              |

## Conventions

Read [`CLAUDE.md`](./CLAUDE.md). The essentials:

- No floating-point money math. Use `bigint` msat and the helpers in `@bitkit-ui/core`.
- `core` stays pure: no DOM, no I/O.
- No hard-coded colors in components. Use `--bk-*` tokens.
- New runtime dependencies need a justification in `docs/PLAN.md` §3.

### Adding a component

1. `packages/elements/src/components/<name>/<name>.ts` (Lit, no decorators, JSDoc with
   `@summary`, `@fires`, `@csspart`, `@slot`) and an `index.ts` re-export.
2. Add it to `src/index.ts` (`pnpm --filter @bitkit-ui/elements build` regenerates the manifest).
3. A story (`<name>.stories.ts`), behavior + axe tests, and a docs example in
   `apps/website/src/lib/examples.ts`.
4. React/Vue wrappers and API docs are generated from the manifest automatically.

## Pull requests

- Keep PRs focused, and include tests.
- Run `pnpm changeset` and describe user-facing changes for any published package.
- Fill in the PR checklist (accessibility, tests, docs).

Good first issues are listed in [docs/ROADMAP.md](./docs/ROADMAP.md).

By contributing you agree your work is released under the MIT license and that you'll follow our
[Code of Conduct](./CODE_OF_CONDUCT.md).
