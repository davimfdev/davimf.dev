import { neon } from '@netlify/neon';
import { createHmac, createHash, timingSafeEqual } from 'crypto';

export const sql = neon();

export type LicenseLevel = 'basic' | 'pro';

export function verifyAdminSecret(req: Request): boolean {
  const provided = req.headers.get('x-admin-secret');
  if (!provided || !process.env.FMM_ADMIN_SECRET) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided, 'utf8'),
      Buffer.from(process.env.FMM_ADMIN_SECRET, 'utf8')
    );
  } catch {
    return false;
  }
}

export function verifyHmac(
  keyHash: string,
  hwidHash: string,
  timestamp: string,
  providedHmac: string
): boolean {
  const appSecret = process.env.FMM_APP_SECRET;
  if (!appSecret) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 600) return false; // ±10 min

  const payload = `${keyHash}:${hwidHash}:${timestamp}`;
  const expected = createHmac('sha256', appSecret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function generateKeyString(): string {
  const hex8 = () =>
    [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  return `FMM-${hex8()}-${hex8()}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
