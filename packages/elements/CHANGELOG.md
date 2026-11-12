# @orange-ui/elements

## 0.1.0

### Minor Changes

- 0572150: Initial release: headless Bitcoin/Lightning core, design tokens, 37 web components, payment
  adapters (mock, BTCPay Server, LNbits, OpenNode, NWC, HTTP), and React/Vue wrappers.

### Patch Changes

- a21e9cb: Remove a phantom `name` event that the manifest analyzer inferred from the internal `emit()`
  helper. React wrappers no longer expose a bogus `onName` prop, and Vue wrappers no longer emit
  `name`.
- Updated dependencies [0572150]
  - @orange-ui/core@0.1.0
  - @orange-ui/tokens@0.1.0
  - @orange-ui/adapters@0.1.0
