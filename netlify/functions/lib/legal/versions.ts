/**
 * Versões dos documentos legais, do ponto de vista do BACKEND.
 *
 * Aqui só entram identificadores e impressões digitais — o texto vive em
 * `src/content/legal/`, que o backend não pode importar: a imagem Docker copia
 * apenas `netlify/` e `server/src`, então esse import compilaria aqui e
 * quebraria no contêiner.
 *
 * A duplicação é intencional e VERIFICADA: `src/content/legal/__tests__/
 * legalHash.test.ts` recalcula os hashes a partir do conteúdo real e falha se
 * este arquivo sair de sincronia. Ao publicar uma versão nova, regenere os
 * valores em vez de digitá-los.
 */

export type LegalDocumentHashes = { terms: string; privacy: string; refund: string };

export const LEGAL_VERSION_HASHES: Record<string, LegalDocumentHashes> = {
  '2026-08-28-v1': {
    terms: '77eaf0a449cfc5f7428c9b89864b990d87402e6de7147578e43fd9f43a657c60',
    privacy: '6ceb917d62f65f1003b656077b945a22a3f88b13bcead1034eb1593d4ac34b0d',
    refund: '6b036094335e04fb926049809a3e96abb5cc5fab9fff5e7dd15cbe25c6ee7190',
  },
};

export const CURRENT_LEGAL_VERSION = '2026-08-28-v1';

/** `hasOwnProperty` e não índice direto: `constructor` não é uma versão. */
export function knownLegalVersion(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEGAL_VERSION_HASHES, id);
}
