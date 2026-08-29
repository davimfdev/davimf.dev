import { describe, expect, it } from 'vitest';
import { CURRENT_LEGAL_VERSION, LEGAL_VERSIONS, legal, legalVersion } from '..';

describe('versões dos documentos legais', () => {
  it('a versão atual existe no registro', () => {
    expect(CURRENT_LEGAL_VERSION).toBe('2026-08-28-v1');
    expect(LEGAL_VERSIONS[CURRENT_LEGAL_VERSION]).toBeDefined();
  });

  it('`legal` continua sendo a versão atual', () => {
    expect(legal.pt).toBe(LEGAL_VERSIONS[CURRENT_LEGAL_VERSION].pt);
    expect(legal.en).toBe(LEGAL_VERSIONS[CURRENT_LEGAL_VERSION].en);
  });

  it('devolve uma versão conhecida e recusa uma desconhecida', () => {
    expect(legalVersion(CURRENT_LEGAL_VERSION)).not.toBeNull();
    expect(legalVersion('2020-01-01-v9')).toBeNull();
    // Aceitar id arbitrário deixaria o cliente alegar um texto que nunca
    // publicamos.
    expect(legalVersion('../../etc/passwd')).toBeNull();
    expect(legalVersion('')).toBeNull();
  });

  it('todo id registrado segue o formato AAAA-MM-DD-vN', () => {
    for (const id of Object.keys(LEGAL_VERSIONS)) {
      expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/);
    }
  });

  it('não deixa substituir uma versão em runtime', () => {
    const original = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
    // Em módulo ES (modo estrito) essa atribuição lança; em modo não
    // estrito ela falha em silêncio. Os dois são aceitáveis — o que importa
    // é que o valor não mude.
    try {
      // @ts-expect-error - tentativa deliberada de violar o congelamento
      LEGAL_VERSIONS[CURRENT_LEGAL_VERSION] = { pt: original.pt, en: original.en };
    } catch {
      // esperado em modo estrito
    }
    expect(LEGAL_VERSIONS[CURRENT_LEGAL_VERSION]).toBe(original);
  });

  it('não deixa mutar um parágrafo dentro de uma versão', () => {
    const section = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION].pt.privacy.sections[0];
    const originalParagraph = section.paragraphs[0];
    try {
      // @ts-expect-error - tentativa deliberada de violar o congelamento
      section.paragraphs[0] = 'texto forjado';
    } catch {
      // esperado em modo estrito
    }
    expect(section.paragraphs[0]).toBe(originalParagraph);
  });

  it('recusa ids que colidem com membros de Object.prototype', () => {
    // Uma regressão para `LEGAL_VERSIONS[id]` sem `hasOwnProperty` devolveria
    // uma função do protótipo em vez de `null` para estes ids.
    expect(legalVersion('constructor')).toBeNull();
    expect(legalVersion('__proto__')).toBeNull();
    expect(legalVersion('toString')).toBeNull();
    expect(legalVersion('valueOf')).toBeNull();
  });
});
