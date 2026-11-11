#!/usr/bin/env node
/**
 * Rename the kit everywhere.
 *
 *   node scripts/rename.mjs --name satskit [--scope @satskit] [--prefix sk] [--display "Sats Kit"] [--repo me/satskit]
 *
 * Reads the current values from kit.config.json, rewrites every git-tracked text file, then
 * updates kit.config.json. Run on a clean working tree so the diff is easy to review.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((s) => {
      const [k, ...v] = s.trim().split(' ');
      return [k, v.join(' ').replace(/^"|"$/g, '')];
    }),
);

const cfgPath = 'kit.config.json';
const cur = JSON.parse(readFileSync(cfgPath, 'utf8'));
if (!args.name) {
  console.error(
    'Usage: node scripts/rename.mjs --name <name> [--scope @x] [--prefix xx] [--display "X"] [--repo owner/repo]',
  );
  process.exit(1);
}
const next = {
  ...cur,
  name: args.name,
  scope: args.scope ?? `@${args.name}`,
  elementPrefix: args.prefix ?? cur.elementPrefix,
  displayName: args.display ?? cur.displayName,
  repo: args.repo ?? cur.repo.replace(cur.name, args.name),
};
next.siteBase = `/${next.repo.split('/')[1]}`;
next.siteUrl = `https://${next.repo.split('/')[0]}.github.io`;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const replacements = [
  [new RegExp(esc(cur.scope) + '/', 'g'), `${next.scope}/`],
  [new RegExp(esc(cur.repo), 'g'), next.repo],
  [new RegExp(esc(cur.displayName), 'g'), next.displayName],
  [new RegExp(`\\b${esc(cur.name)}\\b`, 'g'), next.name],
];
if (next.elementPrefix !== cur.elementPrefix) {
  const p = cur.elementPrefix;
  replacements.push(
    [new RegExp(`\\b${p}-`, 'g'), `${next.elementPrefix}-`],
    [new RegExp(`\\b${pascal(p)}(?=[A-Z])`, 'g'), pascal(next.elementPrefix)],
  );
}

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/\.(png|jpe?g|gif|ico|woff2?|webp)$/i.test(f) && f !== 'pnpm-lock.yaml');

let changed = 0;
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let out = text;
  for (const [re, to] of replacements) out = out.replace(re, to);
  if (out !== text) {
    writeFileSync(f, out);
    changed++;
  }
}
writeFileSync(cfgPath, JSON.stringify(next, null, 2) + '\n');
console.log(
  `Renamed ${cur.name} -> ${next.name} in ${changed} files. Run pnpm install && pnpm build.`,
);
