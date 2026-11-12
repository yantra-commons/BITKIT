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
        // Glob order varies between machines; sort so the committed manifest only diffs on change.
        customElementsManifest.modules.sort((a, b) => a.path.localeCompare(b.path));
        for (const mod of customElementsManifest.modules) {
          for (const d of mod.declarations ?? []) {
            if (d.members) {
              d.members = d.members.filter(
                (m) => !isPrivate(m.name) && m.privacy !== 'private' && m.privacy !== 'protected',
              );
            }
            // The analyzer reads `new CustomEvent(name, …)` inside BitkitElement#emit() as an
            // event literally called "name" and copies it to every subclass. Real events are
            // declared with @fires, so drop that phantom (and anything else inherited from emit).
            if (d.events) {
              d.events = d.events.filter(
                (e) => d.name !== 'BitkitElement' && e.inheritedFrom?.name !== 'BitkitElement',
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
