import { Context } from '@netlify/functions';
import { sql, verifyHmac, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  let body: { key_hash?: string; hwid_hash?: string; timestamp?: string; hmac?: string };
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON'); }

  const { key_hash, hwid_hash, timestamp, hmac } = body;
  if (!key_hash || !hwid_hash || !timestamp || !hmac) return errorResponse('Missing fields');
  if (!verifyHmac(key_hash, hwid_hash, timestamp, hmac))
    return errorResponse('Invalid signature', 401);

  const rows = await sql`
    SELECT k.id, k.level, k.expires_at, k.is_active, k.key_prefix,
           a.hwid_hash AS activation_hwid
    FROM fmm_license_keys k
    LEFT JOIN fmm_license_activations a ON a.key_id = k.id
    WHERE k.key_hash = ${key_hash}
  `;

  if (rows.length === 0) return errorResponse('Key not found', 404);
  const key = rows[0];
  if (!key.is_active) return errorResponse('Key revoked', 403);
  if (key.expires_at && new Date(key.expires_at as string | Date) < new Date())
    return errorResponse('Key expired', 403);
  if (!key.activation_hwid || key.activation_hwid !== hwid_hash)
    return errorResponse('HWID mismatch', 403);

  await sql`
    UPDATE fmm_license_activations SET last_validated_at = NOW() WHERE key_id = ${key.id}
  `;

  return jsonResponse({ level: key.level, expires_at: key.expires_at, key_prefix: key.key_prefix });
};
