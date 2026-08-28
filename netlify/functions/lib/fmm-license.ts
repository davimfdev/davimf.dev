import { createHmac, timingSafeEqual } from 'crypto';
import { authDbSql } from './db.js';
import { generateKeyString, keyPrefixOf, sha256Hex } from './fmm-keygen.js';

// Banco do site (`davimf_dev`) por TCP com pool. Antes era `neon()` do
// @netlify/neon, que lia NETLIFY_DATABASE_URL e falhava com o banco no VPS.
// A resolução agora é preguiçosa: importar este módulo não exige a env var.
export const sql = authDbSql;

// Gerador/derivação de chave vivem em lib/fmm-keygen.ts (sem dependência de
// banco), e são reexportados aqui para os handlers que já os importavam.
export { generateKeyString, keyPrefixOf, sha256Hex };

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

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
