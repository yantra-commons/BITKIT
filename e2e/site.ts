import { readFileSync } from 'node:fs';

const kit = JSON.parse(readFileSync(new URL('../kit.config.json', import.meta.url), 'utf8')) as {
  siteBase: string;
};

/** The docs site under `astro preview`, at the same base path GitHub Pages uses. */
export const SITE = `http://localhost:4400${kit.siteBase}/`;
