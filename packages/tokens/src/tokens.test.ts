import { describe, expect, it } from 'vitest';
import tokens from './tokens.json' with { type: 'json' };
import { buildCss, contrast, flatten, type TokenSource } from './lib.ts';

const source = tokens as unknown as TokenSource & {
  contrastPairs: [string, string, number][];
  themes: Record<'light' | 'dark', { color: Record<string, string> }>;
};

describe('tokens', () => {
  it('light and dark themes define the same keys', () => {
    const l = flatten(source.themes.light).map(([k]) => k);
    const d = flatten(source.themes.dark).map(([k]) => k);
    expect(d).toEqual(l);
  });

  for (const theme of ['light', 'dark'] as const) {
    describe(`${theme} theme contrast (WCAG 2.2 AA)`, () => {
      const colors = source.themes[theme].color;
      for (const [fg, bg, min] of source.contrastPairs) {
        it(`${fg} on ${bg} >= ${min}:1`, () => {
          expect(contrast(colors[fg]!, colors[bg]!)).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }

  it('generates css with zero-specificity selectors and both themes', () => {
    const css = buildCss(source);
    expect(css).toContain(':where(:root');
    expect(css).toContain("[data-bk-theme='dark']");
    expect(css).toContain('--bk-color-accent: #F7931A');
    expect(css).toContain('prefers-reduced-motion');
  });
});
