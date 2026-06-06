import { describe, it, expect } from 'vitest';
import {
  generateRandomPassword,
  generateWordsPassword,
  generatePassphrase,
  AMBIGUOUS,
  type RandomSource,
} from './passwordGenerator';

// Deterministic RNG (LCG) so tests are reproducible.
function seededRng(seed: number): RandomSource {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const allOn = { upper: true, lower: true, digits: true, symbols: true };

describe('generateRandomPassword', () => {
  it('produces a password of the exact requested length', () => {
    const pw = generateRandomPassword(
      { length: 24, enabled: allOn, minDigits: 1, minSymbols: 1 },
      seededRng(1),
    );
    expect(pw).toHaveLength(24);
  });

  it('never contains ambiguous characters', () => {
    for (let seed = 0; seed < 30; seed++) {
      const pw = generateRandomPassword(
        { length: 40, enabled: allOn, minDigits: 1, minSymbols: 1 },
        seededRng(seed),
      );
      for (const ch of pw) expect(AMBIGUOUS).not.toContain(ch);
    }
  });

  it('only uses enabled character pools', () => {
    const pw = generateRandomPassword(
      { length: 30, enabled: { upper: true, lower: true, digits: false, symbols: false }, minDigits: 0, minSymbols: 0 },
      seededRng(2),
    );
    expect(/[0-9!@#$%&*]/.test(pw)).toBe(false);
  });

  it('honors minimum digit and symbol counts', () => {
    const pw = generateRandomPassword(
      { length: 20, enabled: allOn, minDigits: 3, minSymbols: 2 },
      seededRng(3),
    );
    expect((pw.match(/[2-9]/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((pw.match(/[!@#$%&*]/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('never repeats the same character consecutively', () => {
    for (let seed = 0; seed < 30; seed++) {
      const pw = generateRandomPassword(
        { length: 50, enabled: allOn, minDigits: 1, minSymbols: 1 },
        seededRng(seed),
      );
      for (let i = 1; i < pw.length; i++) expect(pw[i]).not.toBe(pw[i - 1]);
    }
  });

  it('never contains an ascending/descending run of 3', () => {
    for (let seed = 0; seed < 30; seed++) {
      const pw = generateRandomPassword(
        { length: 50, enabled: allOn, minDigits: 1, minSymbols: 1 },
        seededRng(seed),
      );
      for (let i = 2; i < pw.length; i++) {
        const d1 = pw.charCodeAt(i - 1) - pw.charCodeAt(i - 2);
        const d2 = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
        expect(d1 === 1 && d2 === 1).toBe(false);
        expect(d1 === -1 && d2 === -1).toBe(false);
      }
    }
  });

  it('throws when no character pool is enabled', () => {
    expect(() =>
      generateRandomPassword(
        { length: 10, enabled: { upper: false, lower: false, digits: false, symbols: false }, minDigits: 0, minSymbols: 0 },
        seededRng(1),
      ),
    ).toThrow('NO_CHARSET');
  });

  it('throws when minimums exceed length', () => {
    expect(() =>
      generateRandomPassword(
        { length: 4, enabled: allOn, minDigits: 3, minSymbols: 3 },
        seededRng(1),
      ),
    ).toThrow('MIN_EXCEEDS_LENGTH');
  });
});

describe('generateWordsPassword', () => {
  const rng = seededRng(7);

  it('uses the requested number of capitalized words', () => {
    const pw = generateWordsPassword({ wordCount: 4, minDigits: 1, minSymbols: 1 }, seededRng(7));
    expect((pw.match(/[A-Z]/g) || []).length).toBe(4);
  });

  it('appends the required digits and symbols', () => {
    const pw = generateWordsPassword({ wordCount: 3, minDigits: 2, minSymbols: 1 }, seededRng(8));
    expect((pw.match(/[2-9]/g) || []).length).toBe(2);
    expect((pw.match(/[!@#$%&*]/g) || []).length).toBe(1);
  });

  it('starts with an uppercase letter', () => {
    const pw = generateWordsPassword({ wordCount: 2, minDigits: 0, minSymbols: 0 }, rng);
    expect(/^[A-Z]/.test(pw)).toBe(true);
  });
});

describe('generatePassphrase', () => {
  it('joins the requested number of words with the separator', () => {
    const phrase = generatePassphrase(
      { wordCount: 5, separator: '-', capitalize: true, includeNumber: false },
      seededRng(11),
    );
    expect(phrase.split('-')).toHaveLength(5);
  });

  it('capitalizes each word when capitalize is true', () => {
    const phrase = generatePassphrase(
      { wordCount: 4, separator: '-', capitalize: true, includeNumber: false },
      seededRng(12),
    );
    for (const word of phrase.split('-')) expect(/^[A-Z]/.test(word)).toBe(true);
  });

  it('keeps words lowercase when capitalize is false', () => {
    const phrase = generatePassphrase(
      { wordCount: 4, separator: '-', capitalize: false, includeNumber: false },
      seededRng(13),
    );
    for (const word of phrase.split('-')) expect(/^[a-z]/.test(word)).toBe(true);
  });

  it('appends a trailing digit when includeNumber is true', () => {
    const phrase = generatePassphrase(
      { wordCount: 3, separator: '-', capitalize: true, includeNumber: true },
      seededRng(14),
    );
    expect(/[2-9]$/.test(phrase)).toBe(true);
  });
});
