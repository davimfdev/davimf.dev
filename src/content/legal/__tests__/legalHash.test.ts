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
