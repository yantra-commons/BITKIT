// Shared reader for packages/elements/custom-elements.json, used by the React/Vue wrapper
// generators and the website API pages.
import { readFileSync } from 'node:fs';

const pascal = (s) =>
  s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

/** Event name → React/Vue handler suffix: "ou-status-change" → "StatusChange". */
export const eventSuffix = (name) => pascal(name.replace(/^ou-/, ''));

/**
 * @returns {Array<{tag:string, className:string, name:string, module:string, entry:string,
 *   description:string, attributes:any[], properties:any[], events:any[], slots:any[],
 *   cssParts:any[], cssProperties:any[]}>}
 */
export function readComponents(manifestUrl) {
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  const out = [];
  for (const mod of manifest.modules) {
    for (const d of mod.declarations ?? []) {
      if (!d.tagName || !d.customElement) continue;
      const folder = mod.path.split('/').at(-2);
      out.push({
        tag: d.tagName,
        className: d.name,
        name: pascal(d.tagName.replace(/^ou-/, '')),
        module: mod.path,
        entry: folder,
        description: (d.summary ?? d.description ?? '').trim(),
        attributes: d.attributes ?? [],
        properties: (d.members ?? []).filter(
          (m) => m.kind === 'field' && !m.static && m.privacy !== 'private' && !m.readonly,
        ),
        methods: (d.members ?? []).filter(
          (m) => m.kind === 'method' && !m.static && m.privacy !== 'private' && !m.privacy,
        ),
        events: (d.events ?? []).filter((e) => e.name),
        slots: d.slots ?? [],
        cssParts: d.cssParts ?? [],
        cssProperties: d.cssProperties ?? [],
      });
    }
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag));
}
