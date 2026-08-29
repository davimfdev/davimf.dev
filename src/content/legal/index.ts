import { legalPt } from './versions/2026-08-28-v1/pt';
import { legalEn } from './versions/2026-08-28-v1/en';
import type { LegalContent } from './types';

export type { LegalContent, LegalDocument, LegalSection } from './types';

export type LegalLocale = 'pt' | 'en';
export type LegalVersionContent = Record<LegalLocale, LegalContent>;

/**
 * Congela recursivamente objetos e arrays, para que nenhum consumidor possa
 * reescrever um snapshot já publicado — nem no nível raiz, nem num parágrafo
 * aninhado. O conteúdo legal é só texto (dezenas de KB), então o custo é
 * irrelevante.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Snapshots imutáveis. Uma revisão ADICIONA um diretório e reaponta
 * `CURRENT_LEGAL_VERSION`; nunca edita um snapshot já publicado, porque algum
 * pedido no banco afirma tê-lo aceitado. O congelamento abaixo torna essa
 * garantia real em runtime, não só uma convenção.
 */
export const LEGAL_VERSIONS: Record<string, LegalVersionContent> = deepFreeze({
  '2026-08-28-v1': { pt: legalPt, en: legalEn },
});

export const CURRENT_LEGAL_VERSION = '2026-08-28-v1';

/** `null` para id desconhecido — nunca lança, nunca inventa. */
export function legalVersion(id: string): LegalVersionContent | null {
  return Object.prototype.hasOwnProperty.call(LEGAL_VERSIONS, id) ? LEGAL_VERSIONS[id] : null;
}

/** A versão vigente. É o que todo consumidor atual do site usa. */
export const legal: LegalVersionContent = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
