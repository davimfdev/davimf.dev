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
});
