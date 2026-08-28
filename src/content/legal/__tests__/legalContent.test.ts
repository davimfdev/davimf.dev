/**
 * O que este arquivo protege:
 *  - PT e EN não divergem em número de seções (uma seção nova traduzida só de
 *    um lado é a falha silenciosa mais provável aqui);
 *  - nenhum texto fica vazio ou com marcador não preenchido;
 *  - a identificação do fornecedor exigida pelo CDC/LGPD está presente;
 *  - as promessas que o texto faz batem com o que o sistema realmente faz.
 */

import { describe, expect, it } from 'vitest';
import { legal } from '..';
import type { LegalDocument } from '../types';

const LOCALES = ['pt', 'en'] as const;
const DOCUMENTS = ['privacy', 'terms', 'refund'] as const;

function allText(document: LegalDocument): string[] {
  return [
    document.title,
    document.summary,
    document.updatedAt,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ];
}

describe('conteúdo legal', () => {
  it('identifica o fornecedor com CNPJ, endereço e canal do titular', () => {
    for (const locale of LOCALES) {
      const { company } = legal[locale];
      expect(company.cnpj).toBe('66.482.628/0001-89');
      expect(company.name).toContain('DAVI MONTEIRO FONSECA');
      expect(company.address).toContain('CEP');
      expect(company.privacyEmail).toBe('privacidade@davimf.dev');
    }
  });

  it('mantém PT e EN com as mesmas seções em cada documento', () => {
    for (const name of DOCUMENTS) {
      expect(legal.en[name].sections).toHaveLength(legal.pt[name].sections.length);
    }
  });

  it('não deixa texto vazio nem marcador por preencher', () => {
    for (const locale of LOCALES) {
      for (const name of DOCUMENTS) {
        for (const text of allText(legal[locale][name])) {
          expect(text.trim()).not.toBe('');
          // Marcadores que não aparecem em prosa. Nada de `/todo/i` aqui: ele
          // casa dentro de "método".
          expect(text).not.toMatch(/\{\{|\[preencher\]|XXXX|TODO:|\bTBD\b/);
        }
      }
    }
  });

  it('a política de reembolso promete o que o código faz', () => {
    // PaymentService revoga a licença no estorno total e suspende no parcial.
    const pt = allText(legal.pt.refund).join(' ');
    expect(pt).toContain('7 dias');
    expect(pt).toContain('revogada');
    expect(pt).toContain('suspensa');

    const en = allText(legal.en.refund).join(' ');
    expect(en).toContain('7 calendar days');
    expect(en).toContain('revoked');
    expect(en).toContain('suspended');
  });

  it('os termos declaram a restrição de uma máquina por chave', () => {
    // fmm-activate.ts recusa a segunda máquina com 409. Restrição à fruição
    // da oferta precisa estar escrita, não descoberta depois da compra.
    expect(allText(legal.pt.terms).join(' ')).toContain('UM único computador');
    expect(allText(legal.en.terms).join(' ')).toContain('ONE computer');
  });

  it('a privacidade declara transferência internacional', () => {
    // Google, Resend, Discord e Mercado Pago tratam dados fora do Brasil;
    // silêncio aqui insinuaria que não há transferência.
    expect(allText(legal.pt.privacy).join(' ')).toContain('fora do Brasil');
    expect(allText(legal.en.privacy).join(' ')).toContain('outside Brazil');
  });

  it('a política de privacidade declara o rastreamento em vez de negá-lo', () => {
    const pt = allText(legal.pt.privacy).join(' ');
    expect(pt).toContain('Google Analytics');
    expect(pt).toContain('consentimento');
    // O texto antigo afirmava que não havia rastreamento de terceiros enquanto
    // o Google Analytics carregava em toda página.
    expect(pt).not.toContain('Não vendemos ou usamos seus dados para rastreamento');
  });

  it('a privacidade afirma que dado de cartão não chega ao servidor', () => {
    const pt = allText(legal.pt.privacy).join(' ');
    expect(pt).toContain('token');
    expect(pt).toMatch(/não armazenamos|nunca passam/i);
  });
});
