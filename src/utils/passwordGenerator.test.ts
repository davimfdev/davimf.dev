import { describe, it, expect } from 'vitest';
import { WORDLIST_PT } from '../data/wordlistPt';
import {
  generateRandomPassword,
  generateWordsPassword,
  generatePassphrase,
  AMBIGUOUS,
  DIGITS,
  SYMBOLS,
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

// A second stub, used where the assertion needs an *exact* output rather
// than "looks right": each call returns the next queued float, and drawing
// past the end throws instead of silently reusing a value.
function makeRng(seq: number[]): RandomSource {
  let i = 0;
  return () => {
    if (i >= seq.length) {
      throw new Error('rng exhausted: generator drew more randomness than the test stubbed');
    }
    return seq[i++];
  };
}

// `randomInt(size, rng) === Math.floor(rng() * size)`. This picks the float
// that lands squarely on `index` for a pool of the given `size`.
function at(index: number, size: number): number {
  return (index + 0.5) / size;
}

const WC = WORDLIST_PT.length;

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
  it('uses the requested number of capitalized words', () => {
    const pw = generateWordsPassword(
      { wordCount: 4, digitCount: 0, symbolStyle: 'none', mixedCase: false },
      seededRng(7),
    );
    expect((pw.match(/[A-Z]/g) || []).length).toBe(4);
  });

  it('starts with an uppercase letter', () => {
    const pw = generateWordsPassword(
      { wordCount: 2, digitCount: 0, symbolStyle: 'none', mixedCase: false },
      seededRng(7),
    );
    expect(/^[A-Z]/.test(pw)).toBe(true);
  });

  it("symbolStyle: 'wrapped' wraps both ends with the same symbol, using a different symbol as the word separator", () => {
    const rng = makeRng([
      at(0, WC), // word 1 -> "abacaxi"
      at(1, WC), // word 2 -> "abelha"
      at(2, SYMBOLS.length), // separator -> '#'
      at(0, SYMBOLS.length - 1), // wrapper, drawn from SYMBOLS minus '#' -> '!'
    ]);

    const pw = generateWordsPassword(
      { wordCount: 2, digitCount: 0, symbolStyle: 'wrapped', mixedCase: false },
      rng,
    );

    expect(pw).toBe('!Abacaxi#Abelha!');
    expect(pw[0]).toBe(pw[pw.length - 1]); // wrapper is identical at both ends
    expect(pw[0]).not.toBe('#'); // wrapper is guaranteed distinct from the separator
  });

  it('attaches the digit run to a chosen word instead of the end of the password (regression for the old trailing-digits bug)', () => {
    const rng = makeRng([
      at(0, WC), // word 1 -> "abacaxi"
      at(1, WC), // word 2 -> "abelha"
      at(2, WC), // word 3 -> "abertura"
      at(0, 3), // digit run attaches to word index 0
      at(0, DIGITS.length), // '2'
      at(1, DIGITS.length), // '3'
      at(2, DIGITS.length), // '4'
    ]);

    const pw = generateWordsPassword(
      { wordCount: 3, digitCount: 3, symbolStyle: 'none', mixedCase: false },
      rng,
    );

    expect(pw).toBe('Abacaxi234AbelhaAbertura');
    // The old code always appended the digit run after joining every word,
    // so the password ended in a digit. It must not anymore.
    expect(/\d$/.test(pw)).toBe(false);
    expect(pw.endsWith('Abertura')).toBe(true);
  });

  it('digitCount: 0 produces no digits at all', () => {
    const rng = makeRng([at(0, WC), at(1, WC)]);

    const pw = generateWordsPassword(
      { wordCount: 2, digitCount: 0, symbolStyle: 'none', mixedCase: false },
      rng,
    );

    expect(pw).toBe('AbacaxiAbelha');
    expect(/\d/.test(pw)).toBe(false);
  });

  it("symbolStyle: 'none' produces no symbols at all", () => {
    const rng = makeRng([
      at(0, WC), // word 1 -> "abacaxi"
      at(1, WC), // word 2 -> "abelha"
      at(2, WC), // word 3 -> "abertura"
      at(1, 3), // digit run attaches to word index 1
      at(4, DIGITS.length), // '6'
      at(5, DIGITS.length), // '7'
    ]);

    const pw = generateWordsPassword(
      { wordCount: 3, digitCount: 2, symbolStyle: 'none', mixedCase: false },
      rng,
    );

    expect(pw).toBe('AbacaxiAbelha67Abertura');
    for (const ch of SYMBOLS) {
      expect(pw.includes(ch)).toBe(false);
    }
  });

  it('mixedCase: false capitalises every word', () => {
    const rng = makeRng([at(3, WC), at(4, WC), at(5, WC)]);

    const pw = generateWordsPassword(
      { wordCount: 3, digitCount: 0, symbolStyle: 'none', mixedCase: false },
      rng,
    );

    // "abraco", "acucar", "adega" — every word capitalised, none left as-typed.
    expect(pw).toBe('AbracoAcucarAdega');
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

  it('includeNumber: true places the digit inside a word, preserving the separator structure', () => {
    const rng = makeRng([
      at(0, WC), // "abacaxi"
      at(1, WC), // "abelha"
      at(2, WC), // "abertura"
      at(3, WC), // "abraco"
      at(1, 4), // digit attaches to word index 1
      at(0, DIGITS.length), // '2'
    ]);

    const phrase = generatePassphrase(
      { wordCount: 4, separator: '-', capitalize: true, includeNumber: true },
      rng,
    );

    expect(phrase).toBe('Abacaxi-Abelha2-Abertura-Abraco');
    // The old code always appended the digit after joining every word, so
    // the phrase ended in a digit. It must not anymore.
    expect(phrase.endsWith('2')).toBe(false);
    expect(phrase.split('-')).toHaveLength(4);
  });
});
