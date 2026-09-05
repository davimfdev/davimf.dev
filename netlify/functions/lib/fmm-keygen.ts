/**
 * Geração/derivação das chaves de licença do FMM.
 *
 * Extraído de lib/fmm-license.ts SEM mudar o formato nem o algoritmo: aquele
 * módulo carrega o cliente de banco, e importá-lo só para gerar uma chave
 * arrastaria a conexão junto. lib/fmm-license.ts reexporta estas funções, então
 * nada que já existia mudou de lugar.
 *
 * Este continua sendo o ÚNICO gerador de chaves do projeto.
 */

import { createHash } from 'node:crypto';

/** Formato histórico: `FMM-XXXXXXXX-XXXXXXXX` (hex maiúsculo). */
export function generateKeyString(): string {
  const hex8 = () =>
    [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  return `FMM-${hex8()}-${hex8()}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** "FMM-XXXXXXXX" - o que já era exibido nas listagens administrativas. */
export function keyPrefixOf(rawKey: string): string {
  return rawKey.substring(0, 12);
}
