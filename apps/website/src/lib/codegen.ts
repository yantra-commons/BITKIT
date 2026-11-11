/**
 * Convert the HTML snippets used in docs into equivalent React (JSX) and Vue (template) code.
 * Handles the subset of HTML the examples use: bk-* tags, plain elements, string and boolean
 * attributes. Amount-like attributes become bigint literals.
 */

const BIGINT_ATTRS = new Set([
  'amount',
  'msat',
  'balance',
  'pending',
  'min',
  'max',
  'target',
  'amount-received',
  'amount-due',
  'default-amount',
]);
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const pascal = (s: string) => camel(s).replace(/^./, (c) => c.toUpperCase());

const TAG_RE = /<(\/?)([a-z][\w-]*)((?:\s+[\w:.@-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
const ATTR_RE = /([\w:.@-]+)(?:="([^"]*)")?/g;

function convertAttrs(attrs: string, mode: 'react' | 'vue', isKit: boolean): string {
  const out: string[] = [];
  for (const m of attrs.matchAll(ATTR_RE)) {
    const [, name = '', value] = m;
    if (!name) continue;
    if (mode === 'react') {
      const key =
        name === 'class'
          ? 'className'
          : name.startsWith('aria-') || name.startsWith('data-') || !isKit
            ? name
            : camel(name);
      if (value === undefined) out.push(key);
      else if (isKit && BIGINT_ATTRS.has(name) && /^\d+$/.test(value))
        out.push(`${key}={${value}n}`);
      else out.push(`${key}="${value}"`);
    } else {
      if (value === undefined) out.push(name);
      else if (isKit && BIGINT_ATTRS.has(name) && /^\d+$/.test(value))
        out.push(`:${name}="${value}n"`);
      else out.push(`${name}="${value}"`);
    }
  }
  return out.length ? ' ' + out.join(' ') : '';
}

function convert(html: string, mode: 'react' | 'vue'): string {
  return html.replace(
    TAG_RE,
    (_full, close: string, tag: string, attrs: string, selfClose: string) => {
      const isKit = tag.startsWith('bk-');
      const name = isKit ? pascal(tag.slice(3)) : tag;
      if (close) return `</${name}>`;
      return `<${name}${convertAttrs(attrs, mode, isKit)}${selfClose ? ' /' : ''}>`;
    },
  );
}

/** Names of kit components used in a snippet, for import lines. */
export const usedComponents = (html: string) =>
  [...new Set([...html.matchAll(/<bk-([\w-]+)/g)].map((m) => pascal(m[1]!)))].sort();

export function toReact(html: string): string {
  const names = usedComponents(html);
  const body = convert(html.trim(), 'react')
    .replace(/<(\w[\w-]*)([^>]*)><\/\1>/g, '<$1$2 />')
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n');
  return `import { ${names.join(', ')} } from '@bitkit-ui/react';

export function Example() {
  return (
    <>
${body}
    </>
  );
}`;
}

export function toVue(html: string): string {
  const names = usedComponents(html);
  const body = convert(html.trim(), 'vue')
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
  return `<script setup lang="ts">
import { ${names.join(', ')} } from '@bitkit-ui/vue';
</script>

<template>
${body}
</template>`;
}
