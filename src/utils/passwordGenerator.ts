// Pure password / passphrase generation. No React, no DOM (except crypto).
// All randomness flows through an injectable RandomSource for testability.
import { WORDLIST_PT } from '../data/wordlistPt';

export type RandomSource = () => number; // returns float in [0, 1)

export type CharType = 'upper' | 'lower' | 'digits' | 'symbols';

// Ambiguous characters are excluded from every pool: 0 O o 1 l I |
export const AMBIGUOUS = '0Oo1lI|';

// Pools already exclude ambiguous characters.
export const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
export const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
export const DIGITS = '23456789'; // no 0, 1
export const SYMBOLS = '!@#$%&*';

export interface RandomOptions {
  length: number; // 5..128
  enabled: Record<CharType, boolean>;
  minDigits: number;
  minSymbols: number;
}

const secureRandom: RandomSource = () => {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 2 ** 32;
};

function randomInt(maxExclusive: number, rng: RandomSource): number {
  return Math.floor(rng() * maxExclusive);
}

// Works for both strings (T = single char) and arrays (T = element).
function pick<T>(items: { length: number; [i: number]: T }, rng: RandomSource): T {
  return items[randomInt(items.length, rng)];
}

function shuffleCopy<T>(arr: T[], rng: RandomSource): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSequenceTriplet(a: string, b: string, c: string): boolean {
  const d1 = b.charCodeAt(0) - a.charCodeAt(0);
  const d2 = c.charCodeAt(0) - b.charCodeAt(0);
  return (d1 === 1 && d2 === 1) || (d1 === -1 && d2 === -1);
}

function isValidNext(out: string[], ch: string): boolean {
  const n = out.length;
  if (n >= 1 && out[n - 1] === ch) return false; // consecutive duplicate
  if (n >= 2 && isSequenceTriplet(out[n - 2], out[n - 1], ch)) return false;
  return true;
}

// Greedily arrange a multiset of chars so no consecutive dup and no run of 3.
// Returns null if it gets stuck (caller retries with a fresh bag).
function arrange(bag: string[], rng: RandomSource): string[] | null {
  const pool = shuffleCopy(bag, rng);
  const used = new Array(pool.length).fill(false);
  const out: string[] = [];
  for (let pos = 0; pos < pool.length; pos++) {
    const cands: number[] = [];
    for (let i = 0; i < pool.length; i++) {
      if (!used[i] && isValidNext(out, pool[i])) cands.push(i);
    }
    if (cands.length === 0) return null;
    const choice = cands[randomInt(cands.length, rng)];
    used[choice] = true;
    out.push(pool[choice]);
  }
  return out;
}

export function generateRandomPassword(
  o: RandomOptions,
  rng: RandomSource = secureRandom,
): string {
  const pools: string[] = [];
  if (o.enabled.upper) pools.push(UPPER);
  if (o.enabled.lower) pools.push(LOWER);
  if (o.enabled.digits) pools.push(DIGITS);
  if (o.enabled.symbols) pools.push(SYMBOLS);
  if (pools.length === 0) throw new Error('NO_CHARSET');

  const minDigits = o.enabled.digits ? o.minDigits : 0;
  const minSymbols = o.enabled.symbols ? o.minSymbols : 0;
  if (minDigits + minSymbols > o.length) throw new Error('MIN_EXCEEDS_LENGTH');

  const all = pools.join('');

  const buildBag = (): string[] => {
    const bag: string[] = [];
    for (let i = 0; i < minDigits; i++) bag.push(pick(DIGITS, rng));
    for (let i = 0; i < minSymbols; i++) bag.push(pick(SYMBOLS, rng));
    while (bag.length < o.length) bag.push(pick(all, rng));
    return bag;
  };

  for (let attempt = 0; attempt < 500; attempt++) {
    const arranged = arrange(buildBag(), rng);
    if (arranged) return arranged.join('');
  }
  throw new Error('GENERATION_FAILED');
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export interface WordsPasswordOptions {
  wordCount: number; // 2..5
  digitCount: number; // 0..6 — length of the digit run attached to one word
  symbolStyle: 'none' | 'separator' | 'wrapped';
  mixedCase: boolean; // draw each word's capitalisation at random instead of always capitalising
}

// Draws a word's capitalisation at random: as typed, Capitalized, or UPPER.
function randomCase(word: string, rng: RandomSource): string {
  const style = randomInt(3, rng);
  if (style === 0) return word;
  if (style === 1) return capitalize(word);
  return word.toUpperCase();
}

export function generateWordsPassword(
  o: WordsPasswordOptions,
  rng: RandomSource = secureRandom,
): string {
  const words: string[] = [];
  for (let i = 0; i < o.wordCount; i++) {
    const w = pick(WORDLIST_PT, rng);
    words.push(o.mixedCase ? randomCase(w, rng) : capitalize(w));
  }

  // Attach the digit run to one randomly chosen word.
  if (o.digitCount > 0) {
    const target = randomInt(words.length, rng);
    let digits = '';
    for (let i = 0; i < o.digitCount; i++) digits += pick(DIGITS, rng);
    words[target] = words[target] + digits;
  }

  let separator = '';
  if (o.symbolStyle === 'separator' || o.symbolStyle === 'wrapped') {
    separator = pick(SYMBOLS, rng);
  }
  let pw = words.join(separator);

  if (o.symbolStyle === 'wrapped') {
    // Guarantee wrapper !== separator by picking from the remaining symbols.
    const remaining = SYMBOLS.split('').filter((c) => c !== separator).join('');
    const wrapper = pick(remaining, rng);
    pw = wrapper + pw + wrapper;
  }

  return pw;
}

export interface PassphraseOptions {
  wordCount: number; // 3..10
  separator: '-' | '.' | '_' | ' ' | '';
  capitalize: boolean;
  includeNumber: boolean;
}

export function generatePassphrase(
  o: PassphraseOptions,
  rng: RandomSource = secureRandom,
): string {
  const words: string[] = [];
  for (let i = 0; i < o.wordCount; i++) {
    const w = pick(WORDLIST_PT, rng);
    words.push(o.capitalize ? capitalize(w) : w);
  }
  if (o.includeNumber) {
    const target = randomInt(words.length, rng);
    words[target] = words[target] + pick(DIGITS, rng);
  }
  return words.join(o.separator);
}
