import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_AGE_MS = 10 * 60_000;

type StatePayload = { iat: number; nonce: string; returnTo: string };

function secret(): string {
  const value = process.env.DASHBOARD_SESSION_SECRET;
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('DASHBOARD_SESSION_SECRET must contain at least 32 bytes');
  }
  return value;
}

function signature(payload: string): string {
  return createHmac('sha256', secret()).update(payload, 'utf8').digest('base64url');
}

function safeReturnTo(value: string): string {
  return value.startsWith('/dashboard') && !value.startsWith('//') ? value : '/dashboard';
}

export function createOAuthState(returnTo = '/dashboard', now = Date.now()): string {
  const payload: StatePayload = {
    iat: now,
    nonce: randomBytes(18).toString('base64url'),
    returnTo: safeReturnTo(returnTo),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function validateOAuthState(
  queryState: string | null,
  cookieState: string | null,
  now = Date.now(),
): { returnTo: string } | null {
  if (!queryState || !cookieState) return null;
  const queryBytes = Buffer.from(queryState, 'utf8');
  const cookieBytes = Buffer.from(cookieState, 'utf8');
  if (queryBytes.length !== cookieBytes.length || !timingSafeEqual(queryBytes, cookieBytes)) return null;
  const [encoded, provided, extra] = queryState.split('.');
  if (!encoded || !provided || extra) return null;
  const expected = signature(encoded);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload;
    if (!Number.isFinite(payload.iat) || payload.iat > now || now - payload.iat > MAX_AGE_MS) return null;
    if (typeof payload.nonce !== 'string' || payload.nonce.length < 16) return null;
    return { returnTo: safeReturnTo(payload.returnTo) };
  } catch {
    return null;
  }
}
