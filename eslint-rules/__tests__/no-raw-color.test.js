/**
 * Uma regra de lint que não reporta nada parece verde e passa despercebida.
 * O caso negativo - o hex dentro de DATA_PALETTE_* que NÃO deve ser reportado -
 * é o que protege a decisão do spec §6.3 de virar uma isenção larga por
 * descuido.
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../no-raw-color.js';

// O RuleTester usa describe/it globais quando existem; no vitest eles são
// importados, então precisam ser injetados.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-raw-color', rule, {
  valid: [
    { code: `const c = 'text-fg-muted';` },
    { code: `const c = 'bg-surface-1 border-line';` },
    { code: `const c = \`text-\${tone} rounded-panel\`;` },
    // A isenção, que é por declaração:
    { code: `export const DATA_PALETTE_CATEGORY = ['#6366f1', '#a855f7'];` },
    { code: `const DATA_PALETTE = ['#fff'];` },
    // Forma real de DATA_PALETTE_DISCORD: literais aninhados num objeto.
    { code: `const DATA_PALETTE_DISCORD = { blurple: '#5865F2', danger: '#da373c' };` },
    // O requisito do dígito é o que faz `rgb(var(--token) / alfa)` passar.
    { code: `const c = 'rgb(var(--accent) / .07)';` },
    { code: "const c = `rgb(${channels} / ${alpha})`;" },
    // Escape explícito continua sendo do ESLint, não da regra.
  ],
  invalid: [
    // `text-[#…]` é valor arbitrário: reporta arbitraryColor, e a regra NÃO
    // duplica o mesmo achado como rawHex.
    {
      code: `const c = 'text-[#F5F3EF]';`,
      errors: [{ messageId: 'arbitraryColor' }],
    },
    {
      code: `const c = \`border-[#E6B566] p-4\`;`,
      errors: [{ messageId: 'arbitraryColor' }],
    },
    // Hex solto, fora de sintaxe do Tailwind: rawHex.
    {
      code: `const s = { color: '#fff' };`,
      errors: [{ messageId: 'rawHex' }],
    },
    {
      code: `const border = '1px solid #374151';`,
      errors: [{ messageId: 'rawHex' }],
    },
    // Função de cor com números crus, sem hex nem sintaxe Tailwind: rawFunction.
    {
      code: `const c = '1px solid rgb(55, 65, 81)';`,
      errors: [{ messageId: 'rawFunction' }],
    },
    {
      code: `const c = 'hsl(30, 70%, 50%)';`,
      errors: [{ messageId: 'rawFunction' }],
    },
    {
      code: `const c = 'text-red-400';`,
      errors: [{ messageId: 'tailwindPalette' }],
    },
    {
      code: `const c = 'text-gray-400 bg-white/[0.02]';`,
      errors: [{ messageId: 'tailwindPalette' }, { messageId: 'arbitraryColor' }],
    },
    // A isenção é da declaração, não do arquivo: fora dela a regra vale.
    {
      code: `const DATA_PALETTE_X = ['#fff']; const chrome = '#000';`,
      errors: [{ messageId: 'rawHex' }],
    },
  ],
});
