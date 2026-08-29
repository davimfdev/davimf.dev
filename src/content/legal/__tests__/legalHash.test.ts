import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_LEGAL_VERSION, LEGAL_VERSIONS } from '..';
import { canonicalise, hashDocument, versionHashes } from '../hash';
import {
  CURRENT_LEGAL_VERSION as BACKEND_VERSION,
  LEGAL_VERSION_HASHES,
} from '../../../../netlify/functions/lib/legal/versions';

describe('hash canônico dos documentos', () => {
  it('ignora a ordem das chaves', () => {
    expect(canonicalise({ b: 1, a: 2 })).toBe(canonicalise({ a: 2, b: 1 }));
  });

  it('NÃO ignora a ordem de um array', () => {
    // Ordem de seções e parágrafos é conteúdo: trocar dois parágrafos muda o
    // documento que a pessoa leu.
    expect(canonicalise(['a', 'b'])).not.toBe(canonicalise(['b', 'a']));
  });

  it('muda quando uma palavra muda', () => {
    const content = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
    const original = hashDocument(content.pt.terms);
    const edited = hashDocument({
      ...content.pt.terms,
      sections: [
        { ...content.pt.terms.sections[0], paragraphs: ['outro texto'] },
        ...content.pt.terms.sections.slice(1),
      ],
    });
    expect(edited).not.toBe(original);
  });

  it('devolve 64 hex por documento, distintos entre si', () => {
    const hashes = versionHashes(LEGAL_VERSIONS[CURRENT_LEGAL_VERSION]);
    for (const value of Object.values(hashes)) expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(Object.values(hashes)).size).toBe(3);
  });

  it('muda quando uma palavra muda no inglês', () => {
    // Prova que o inglês realmente alimenta o dígito: um `pair()` que usasse
    // `pt` para os dois lados passaria por engano em todos os outros testes,
    // porque o teste vinculante compara recalculado com recalculado.
    const content = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
    const original = versionHashes(content).terms;
    const edited: typeof content = {
      ...content,
      en: {
        ...content.en,
        terms: {
          ...content.en.terms,
          sections: [
            { ...content.en.terms.sections[0], paragraphs: ['different text'] },
            ...content.en.terms.sections.slice(1),
          ],
        },
      },
    };
    expect(versionHashes(edited).terms).not.toBe(original);
  });

  it('trata NFC e NFD do mesmo caractere visível como o mesmo hash', () => {
    // "café": NFC usa um único codepoint (\u00e9); NFD usa "e" + acento
    // combinante (\u0301). Bytes diferentes, mesmo texto lido — o hash não
    // pode discordar disso.
    const base = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION].pt.terms;
    const nfc = { ...base, title: 'caf\u00e9' };
    const nfd = { ...base, title: 'cafe\u0301' };
    expect(nfc.title).not.toBe(nfd.title);
    expect(hashDocument(nfc)).toBe(hashDocument(nfd));
  });
});

describe('isolamento do módulo hash', () => {
  it('não é importado fora de testes (evita node:crypto no bundle)', () => {
    const hashFile = resolve('src/content/legal/hash.ts').replace(/\.ts$/, '');
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;

    function listSourceFiles(dir: string): string[] {
      const files: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listSourceFiles(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
      return files;
    }

    const offenders = listSourceFiles(resolve('src'))
      .filter((file) => file.replace(/\.tsx?$/, '') !== hashFile)
      .filter((file) => {
        const content = readFileSync(file, 'utf8');
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content))) {
          const resolved = resolve(dirname(file), match[1]).replace(/\.tsx?$/, '');
          if (resolved === hashFile) return true;
        }
        return false;
      });

    expect(offenders).toEqual([]);
  });
});

describe('registro do backend', () => {
  it('aponta para a mesma versão vigente que o frontend', () => {
    expect(BACKEND_VERSION).toBe(CURRENT_LEGAL_VERSION);
  });

  it('conhece exatamente as mesmas versões', () => {
    expect(Object.keys(LEGAL_VERSION_HASHES).sort()).toEqual(Object.keys(LEGAL_VERSIONS).sort());
  });

  it('guarda os hashes REAIS de cada versão', () => {
    // Este é o teste que torna a duplicação segura: editar um snapshot sem
    // regenerar o registro quebra aqui, e não em produção.
    for (const [id, content] of Object.entries(LEGAL_VERSIONS)) {
      expect(LEGAL_VERSION_HASHES[id]).toEqual(versionHashes(content));
    }
  });
});
