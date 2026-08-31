/**
 * Trava de acessibilidade da paleta.
 *
 * O teste LÊ `tokens.css` em vez de repetir os valores aqui: uma cópia local
 * viraria uma segunda fonte de verdade, e clarear um token no CSS deixaria o
 * teste verde. Lendo o arquivo, quem mexer na paleta quebra este teste.
 *
 * Foi este cálculo que reprovou `#6B6B67` (3,77:1) e definiu os tokens de
 * estado — ver spec §4.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgb = [number, number, number];

const TOKENS_PATH = resolve(__dirname, '../../../styles/tokens.css');
const TAILWIND_PATH = resolve(__dirname, '../../../../tailwind.config.js');

const tokensCss = readFileSync(TOKENS_PATH, 'utf8');

/** Extrai os três canais de um token opaco declarado como `--nome: R G B;`. */
function channels(name: string): Rgb {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`));
  if (!match) throw new Error(`token --${name} não encontrado em tokens.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Luminância relativa, WCAG 2.1. */
function luminance([r, g, b]: Rgb): number {
  const linear = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['fg', 'fg-soft', 'fg-muted', 'accent', 'accent-bright', 'danger', 'ok', 'warn'];
const BACKGROUNDS = ['bg', 'surface-1', 'surface-2', 'surface-3'];

describe('contraste dos tokens de texto', () => {
  for (const text of TEXT) {
    for (const background of BACKGROUNDS) {
      it(`${text} sobre ${background} atinge AA (4,5:1)`, () => {
        expect(ratio(channels(text), channels(background))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('o cinza legado #6B6B67 reprovaria — por isso fg-subtle não existe', () => {
    // 20 pontos do site usavam este valor antes da migração. 3,77:1.
    expect(ratio([107, 107, 103], channels('bg'))).toBeLessThan(4.5);
  });
});

describe('integridade dos tokens', () => {
  it('todo token de cor está mapeado no Tailwind', () => {
    const config = readFileSync(TAILWIND_PATH, 'utf8');
    const all = [...TEXT, ...BACKGROUNDS, 'line', 'line-strong', 'surface-nav', 'print-bg', 'print-fg'];
    for (const token of all) {
      // Casa o call site real: `withAlpha('fg')` para os tokens opacos, ou
      // `var(--line)` para os três que já são rgba. Um comentário `// --fg`
      // não satisfaz nenhum dos dois — e é esse o ponto: o teste tem que
      // quebrar quando o mapeamento sai, não quando o comentário sai.
      const mapped =
        config.includes(`withAlpha('${token}')`) || config.includes(`var(--${token})`);
      expect(mapped, `--${token} não está mapeado em tailwind.config.js`).toBe(true);
    }
  });
});
