import axe from 'axe-core';
import { expect } from 'vitest';

type Updatable = HTMLElement & { updateComplete?: Promise<unknown> };

/** Render markup into the document and wait for the first element to finish updating. */
export async function fixture<T extends HTMLElement>(markup: string): Promise<T> {
  const wrap = document.createElement('div');
  wrap.innerHTML = markup;
  document.body.append(wrap);
  const el = wrap.firstElementChild as T & Updatable;
  await el.updateComplete;
  await settle(el);
  return el;
}

/** Wait for an element (and nested Lit children) to settle. */
export async function settle(el: Element): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await (el as Updatable).updateComplete;
    const nested = [...(el.shadowRoot?.querySelectorAll('*') ?? [])].filter(
      (n) => 'updateComplete' in n,
    );
    await Promise.all(nested.map((n) => (n as Updatable).updateComplete));
  }
}

/** Shadow-root query helper. */
export const $ = <T extends Element = HTMLElement>(el: Element, selector: string) =>
  el.shadowRoot!.querySelector(selector) as T;

/**
 * Run axe-core on an element (including open shadow roots). Color contrast is checked against
 * the token pairs in @bitkit-ui/tokens and in real browsers via Playwright, not in happy-dom.
 */
export async function expectAccessible(el: Element, disable: string[] = []): Promise<void> {
  const rules: Record<string, { enabled: boolean }> = {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  };
  for (const r of disable) rules[r] = { enabled: false };
  const results = await axe.run(el, { rules });
  const problems = results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(problems).toEqual([]);
}

export const nextFrame = () => new Promise((r) => setTimeout(r, 0));
