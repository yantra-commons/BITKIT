import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Treat <ou-*> tags in templates as custom elements.
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('ou-') } } }),
  ],
});
