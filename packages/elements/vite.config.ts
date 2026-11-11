import { defineConfig } from 'vite';

// Self-contained CDN bundle: Lit, core, tokens and uqr inlined into one ES module.
export default defineConfig({
  build: {
    outDir: 'dist/cdn',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'bitkit-ui.js' },
    rollupOptions: { external: [] },
  },
});
