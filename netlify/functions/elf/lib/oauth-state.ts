import { randomToken, signToken, verifySignedToken } from './crypto';

export const ELF_OAUTH_STATE_COOKIE = 'elf_oauth_state';

/** Só caminho relativo. URL absoluta ou protocol-relative viraria open redirect. */
export function isSafeReturnTo(value: string): boolean {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  return true;
}

export function createOAuthState(returnTo: string): string {
  const safe = isSafeReturnTo(returnTo) ? returnTo : '/';
  const payload = Buffer.from(JSON.stringify({ n: randomToken(), r: safe }), 'utf8').toString(
    'base64url',
  );
  return signToken(payload);
}

/** Devolve o destino pós-login, ou `null` se o state não confere com o cookie. */
export function readOAuthState(
  queryState: string | null,
  cookieState: string | null,
): { returnTo: string } | null {
  if (!queryState || !cookieState || queryState !== cookieState) return null;
  const payload = verifySignedToken(queryState);
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    // Assinatura válida com payload ilegível: trata como state inválido.
    return null;
  }
  const returnTo = (parsed as { r?: unknown } | null)?.r;
  if (typeof returnTo !== 'string' || !isSafeReturnTo(returnTo)) return null;
  return { returnTo };
}
