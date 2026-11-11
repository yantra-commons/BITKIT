import { createRequire } from 'node:module';
import { expect, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

/** Run axe-core (including color contrast) in a real browser, traversing shadow roots. */
export async function expectNoA11yViolations(
  page: Page,
  options: { exclude?: string[]; disable?: string[] } = {},
) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(
    async ({ exclude, disable }) => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              ctx: unknown,
              opts: unknown,
            ) => Promise<{
              violations: { id: string; help: string; nodes: { target: unknown[] }[] }[];
            }>;
          };
        }
      ).axe;
      const rules = Object.fromEntries(disable.map((r) => [r, { enabled: false }]));
      const res = await axe.run(
        { exclude: exclude.map((s) => [s]) },
        { rules, resultTypes: ['violations'] },
      );
      return res.violations.map(
        (v) =>
          `${v.id}: ${v.help} -> ${v.nodes
            .slice(0, 3)
            .map((n) => JSON.stringify(n.target))
            .join(' | ')}`,
      );
    },
    { exclude: options.exclude ?? [], disable: options.disable ?? [] },
  );
  expect(violations).toEqual([]);
}

/** Text content from inside a component's shadow root (Playwright pierces open shadow DOM). */
export const shadowText = (page: Page, selector: string) =>
  page.locator(selector).first().innerText();
