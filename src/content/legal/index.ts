import { legalPt } from './versions/2026-08-28-v1/pt';
import { legalEn } from './versions/2026-08-28-v1/en';
import type { LegalContent } from './types';

export type { LegalContent, LegalDocument, LegalSection } from './types';

export type LegalLocale = 'pt' | 'en';
export type LegalVersionContent = Record<LegalLocale, LegalContent>;

/**
 * Snapshots imutáveis. Uma revisão ADICIONA um diretório e reaponta
 * `CURRENT_LEGAL_VERSION`; nunca edita um snapshot já publicado, porque algum
 * pedido no banco afirma tê-lo aceitado.
 */
export const LEGAL_VERSIONS: Record<string, LegalVersionContent> = {
  '2026-08-28-v1': { pt: legalPt, en: legalEn },
};

export const CURRENT_LEGAL_VERSION = '2026-08-28-v1';

/** `null` para id desconhecido — nunca lança, nunca inventa. */
export function legalVersion(id: string): LegalVersionContent | null {
  return Object.prototype.hasOwnProperty.call(LEGAL_VERSIONS, id) ? LEGAL_VERSIONS[id] : null;
}

/** A versão vigente. É o que todo consumidor atual do site usa. */
export const legal: LegalVersionContent = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
