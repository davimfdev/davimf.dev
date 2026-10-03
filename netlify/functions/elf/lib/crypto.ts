import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Mesmo desenho de `lib/dashboard/crypto.ts`, com segredo próprio: revogar ou
 * girar a sessão do $elfControl não pode derrubar o dashboard do bot, e vice-versa.
 */
function signingKey(): Buffer {
  const value = process.env.ELF_SESSION_SECRET;
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('ELF_SESSION_SECRET precisa de no mínimo 32 bytes');
  }
  return Buffer.from(value, 'utf8');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function signatureOf(id: string): string {
  return createHmac('sha256', signingKey()).update(id, 'utf8').digest('base64url');
}

export function signToken(id: string): string {
  return `${id}.${signatureOf(id)}`;
}

/** Devolve o id assinado, ou `null` se a assinatura não confere. */
export function verifySignedToken(value: string): string | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const id = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1), 'utf8');
  const expected = Buffer.from(signatureOf(id), 'utf8');
  if (provided.length !== expected.length) return null;
  // Tempo constante: comparar byte a byte com saída antecipada deixaria o
  // atacante descobrir a assinatura medindo o tempo de resposta.
  return timingSafeEqual(provided, expected) ? id : null;
}
