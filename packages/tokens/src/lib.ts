// Pure helpers shared by the build script and tests. Runs under Node's type stripping.
export const PREFIX = 'ou';

type TokenTree = { [key: string]: string | TokenTree };

/** Flatten a nested token group into [cssVarName, value] pairs. */
export function flatten(obj: TokenTree, path: string[] = []): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') out.push(...flatten(value, [...path, key]));
    else out.push([`--${PREFIX}-${[...path, key].join('-')}`, String(value)]);
  }
  return out;
}

const decl = (pairs: [string, string][], indent = '  '): string =>
  pairs.map(([k, v]) => `${indent}${k}: ${v};`).join('\n');

export interface TokenSource {
  base: TokenTree;
  themes: { light: TokenTree; dark: TokenTree };
}

/**
 * Build the token stylesheet. Selectors are wrapped in :where() (specificity 0) so any
 * consumer override such as `:root { --ou-color-accent: hotpink }` wins regardless of order.
 * Theme selection: `data-ou-theme="light|dark"` on any ancestor (or the element itself),
 * otherwise follows prefers-color-scheme.
 */
export function buildCss(tokens: TokenSource): string {
  const base = flatten(tokens.base);
  const light = flatten(tokens.themes.light);
  const dark = flatten(tokens.themes.dark);
  const focus: [string, string][] = [
    [
      `--${PREFIX}-focus-ring`,
      `0 0 0 2px var(--${PREFIX}-color-bg), 0 0 0 4px var(--${PREFIX}-color-focus)`,
    ],
  ];
  return `/* orange-ui design tokens — generated from tokens.json, do not edit. */
:where(:root, [data-ou-theme]) {
${decl([...base, ...focus])}
}
:where(:root, [data-ou-theme='light']) {
  color-scheme: light;
${decl(light)}
}
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-ou-theme='light'])) {
    color-scheme: dark;
${decl(dark, '    ')}
  }
}
:where([data-ou-theme='dark']) {
  color-scheme: dark;
${decl(dark)}
}
@media (prefers-reduced-motion: reduce) {
  :where(:root, [data-ou-theme]) {
    --${PREFIX}-duration-fast: 0ms;
    --${PREFIX}-duration-normal: 0ms;
    --${PREFIX}-duration-slow: 0ms;
  }
}
`;
}

/** WCAG 2.x relative luminance of a #RRGGBB color. */
export function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
