---
'@bitkit-ui/elements': patch
'@bitkit-ui/react': patch
'@bitkit-ui/vue': patch
---

Remove a phantom `name` event that the manifest analyzer inferred from the internal `emit()`
helper. React wrappers no longer expose a bogus `onName` prop, and Vue wrappers no longer emit
`name`.
