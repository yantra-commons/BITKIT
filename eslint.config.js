import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/.astro/**',
      '**/.next/**',
      '**/custom-elements.json',
      'apps/website/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // core is headless: no DOM globals (universal globals like URL/TextDecoder/crypto are fine).
    files: ['packages/core/src/**/*.ts', 'packages/adapters/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'location',
        'customElements',
        'HTMLElement',
      ],
    },
  },
  {
    // No floating point money math in the units module.
    files: ['packages/core/src/units/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', 'parseFloat', 'parseInt'],
      'no-restricted-properties': [
        'error',
        { object: 'Number', property: 'parseFloat' },
        { object: 'Math', property: 'round' },
        { object: 'Math', property: 'floor' },
        { property: 'toFixed' },
      ],
    },
  },
);
