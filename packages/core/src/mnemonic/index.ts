/**
 * BIP39 helpers for mnemonic entry and backup verification UIs.
 *
 * SECURITY: these helpers only validate words and checksums. Nothing here derives keys,
 * performs I/O, or retains input. Callers must keep mnemonics in memory only.
 * Exposed as a separate entry point (`@bitkit-ui/core/mnemonic`) so the 2048-word list is
 * only bundled by apps that need it.
 */
import { validateMnemonic } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';

export const wordlist: readonly string[] = english;
export const VALID_WORD_COUNTS = [12, 15, 18, 21, 24] as const;

const set = new Set(english);

export const isBip39Word = (w: string) => set.has(w.trim().toLowerCase());

/** Words starting with `prefix` (lower-cased), up to `limit`. */
export function suggestWords(prefix: string, limit = 6): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  for (const w of english) {
    if (w.startsWith(p)) {
      out.push(w);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Auto-complete a prefix when it identifies exactly one word. BIP39 English words are unique
 * in their first four letters, so 4+ letters always resolve if valid.
 */
export function completeWord(prefix: string): string | null {
  const matches = suggestWords(prefix, 2);
  if (matches.length === 1) return matches[0]!;
  const exact = prefix.trim().toLowerCase();
  return set.has(exact) ? exact : null;
}

/** Split user input into normalised words. */
export const splitMnemonic = (input: string): string[] =>
  input
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);

export interface MnemonicCheck {
  valid: boolean;
  wordCountValid: boolean;
  /** Indices of words not in the BIP39 list. */
  invalidWordIndices: number[];
  /** Checksum validity (false when words/length are invalid). */
  checksumValid: boolean;
  message?: string;
}

/** Validate a list of mnemonic words: count, wordlist membership, checksum. */
export function checkMnemonic(words: readonly string[]): MnemonicCheck {
  const norm = words.map((w) => w.trim().toLowerCase());
  const invalidWordIndices = norm.flatMap((w, i) => (set.has(w) ? [] : [i]));
  const wordCountValid = (VALID_WORD_COUNTS as readonly number[]).includes(norm.length);
  const checksumValid =
    wordCountValid && invalidWordIndices.length === 0 && validateMnemonic(norm.join(' '), english);
  let message: string | undefined;
  if (invalidWordIndices.length) {
    message = `Word ${invalidWordIndices.map((i) => i + 1).join(', ')} ${invalidWordIndices.length === 1 ? 'is' : 'are'} not in the word list.`;
  } else if (!wordCountValid) {
    message = 'A recovery phrase has 12, 15, 18, 21 or 24 words.';
  } else if (!checksumValid) {
    message = 'These words are valid, but the phrase is not. Check the order and spelling.';
  }
  return { valid: checksumValid, wordCountValid, invalidWordIndices, checksumValid, message };
}

/** Cryptographically random integer in [0, max). */
function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % max;
  }
}

/**
 * Pick `count` distinct random word positions (0-based, sorted) out of `total`, for a
 * "verify your backup" flow.
 */
export function pickBackupCheckIndices(
  total: number,
  count = 3,
  rand: (max: number) => number = randomInt,
): number[] {
  if (count > total) throw new RangeError('count exceeds total');
  const picked = new Set<number>();
  while (picked.size < count) picked.add(rand(total));
  return [...picked].sort((a, b) => a - b);
}

/** Choices for one backup-check question: the right word plus `n - 1` random decoys, shuffled. */
export function backupCheckChoices(
  correct: string,
  n = 4,
  rand: (max: number) => number = randomInt,
): string[] {
  const choices = new Set([correct]);
  while (choices.size < n) choices.add(english[rand(english.length)]!);
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
