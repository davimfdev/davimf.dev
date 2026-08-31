/**
 * O site é PT/EN. A tipagem já obriga paridade de chaves, mas não impede um
 * `en` copiado do `pt` — e é assim que uma tradução esquecida passa.
 *
 * Também trava duas decisões do spec que são fáceis de erodir: nenhuma métrica
 * operacional inventada, e nenhuma menção de violeta fora da captura.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../../context/LanguageContext.tsx'),
  'utf8',
);

function homeBlock(language: 'pt' | 'en'): string {
  const start = source.indexOf(`${language}: {`);
  const home = source.indexOf('home: {', start);
  expect(home, `bloco home ausente em ${language}`).toBeGreaterThan(-1);
  // Vai até o fechamento do objeto home: a primeira linha com indentação de
  // 4 espaços seguida de `},`.
  const end = source.indexOf('\n    },', home);
  return source.slice(home, end);
}

describe('conteúdo da Home', () => {
  it('existe em PT e em EN', () => {
    expect(homeBlock('pt').length).toBeGreaterThan(200);
    expect(homeBlock('en').length).toBeGreaterThan(200);
  });

  it('o EN não é uma cópia do PT', () => {
    expect(homeBlock('en')).not.toBe(homeBlock('pt'));
  });

  it('não inventa métrica operacional', () => {
    // Spec §6: não há backend para uptime, containers ou deploys. Um número
    // desses na Home seria telemetria falsa.
    const proibido = /\b\d+(\.\d+)?%\s*uptime|\b\d+\s+containers?\b|\b\d+\s+deploys?\b/i;
    expect(homeBlock('pt')).not.toMatch(proibido);
    expect(homeBlock('en')).not.toMatch(proibido);
  });
});
