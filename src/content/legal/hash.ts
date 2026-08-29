/**
 * Impressão digital do TEXTO de cada documento.
 *
 * Sai de uma serialização canônica — chaves ordenadas, sem espaçamento — e não
 * do arquivo-fonte. Reordenar campos ou reindentar não faz um documento
 * inalterado parecer alterado; mudar uma palavra sempre muda o hash. A ordem
 * dos ARRAYS é preservada de propósito: a sequência de seções e parágrafos é
 * conteúdo, não formatação.
 *
 * A string canônica é normalizada para NFC antes de virar hash: "é" escrito
 * como um único codepoint ou como "e" + acento combinante são bytes
 * diferentes para o mesmo texto lido, e isso não pode virar um alarme falso
 * de "documento alterado".
 *
 * USA `node:crypto` — só testes e a geração do registro importam este arquivo.
 * Importá-lo de um componente arrastaria `node:crypto` para o bundle.
 */

import { createHash } from 'node:crypto';
import type { LegalContent, LegalDocument } from './types';

export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalise(item)}`).join(',')}}`;
}

export function hashDocument(document: LegalDocument): string {
  return createHash('sha256').update(canonicalise(document).normalize('NFC'), 'utf8').digest('hex');
}

/** Um par pt/en do mesmo documento — a unidade que de fato é hasheada. */
type BilingualDocument = { pt: LegalDocument; en: LegalDocument };

function hashBilingualDocument(document: BilingualDocument): string {
  return createHash('sha256').update(canonicalise(document).normalize('NFC'), 'utf8').digest('hex');
}

/**
 * Um hash por documento, cobrindo os DOIS idiomas: são traduções do mesmo
 * contrato, e a versão identifica o contrato, não a tradução.
 */
export function versionHashes(content: Record<'pt' | 'en', LegalContent>): {
  terms: string;
  privacy: string;
  refund: string;
} {
  const pair = (key: 'terms' | 'privacy' | 'refund'): BilingualDocument => ({
    pt: content.pt[key],
    en: content.en[key],
  });
  return {
    terms: hashBilingualDocument(pair('terms')),
    privacy: hashBilingualDocument(pair('privacy')),
    refund: hashBilingualDocument(pair('refund')),
  };
}
