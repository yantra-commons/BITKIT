/** Custom Elements Manifest config — drives docs tables and React/Vue wrapper generation. */
const isPrivate = (name = '') => name.startsWith('_') || name.startsWith('#');

export default {
  globs: ['src/components/**/*.ts', 'src/internal/base.ts', 'src/internal/form-control.ts'],
  exclude: ['**/*.test.ts', '**/*.stories.ts', '**/index.ts'],
  outdir: '.',
  litelement: true,
  plugins: [
    {
      name: 'bitkit-strip-private',
      packageLinkPhase({ customElementsManifest }) {
        for (const mod of customElementsManifest.modules) {
          for (const d of mod.declarations ?? []) {
            if (d.members) {
              d.members = d.members.filter(
                (m) => !isPrivate(m.name) && m.privacy !== 'private' && m.privacy !== 'protected',
              );
            }
            if (d.attributes) {
              d.attributes = d.attributes.filter(
                (a) => !isPrivate(a.name) && !isPrivate(a.fieldName),
              );
            }
          }
        }
      },
    },
  ],
};
