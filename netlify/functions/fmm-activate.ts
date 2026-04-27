import { Context } from '@netlify/functions';
import { sql, verifyHmac, sha256Hex, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  let body: { key_hash?: string; hwid_hash?: string; timestamp?: string; hmac?: string };
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON'); }

  const { key_hash, hwid_hash, timestamp, hmac } = body;
  if (!key_hash || !hwid_hash || !timestamp || !hmac) return errorResponse('Missing fields');
  if (!verifyHmac(key_hash, hwid_hash, timestamp, hmac))
    return errorResponse('Invalid signature', 401);

  const keys = await sql`
    SELECT id, level, expires_at, is_active, key_prefix
    FROM fmm_license_keys
    WHERE key_hash = ${key_hash}
  `;

  if (keys.length === 0) return errorResponse('Key not found', 404);
  const key = keys[0];
  if (!key.is_active) return errorResponse('Key revoked', 403);
  if (key.expires_at && new Date(key.expires_at) < new Date())
    return errorResponse('Key expired', 403);

  const activations = await sql`
    SELECT hwid_hash FROM fmm_license_activations WHERE key_id = ${key.id}
  `;

  if (activations.length > 0 && activations[0].hwid_hash !== hwid_hash)
    return errorResponse('Key already activated on another machine', 409);

  if (activations.length === 0) {
    await sql`
      INSERT INTO fmm_license_activations (key_id, hwid_hash)
      VALUES (${key.id}, ${hwid_hash})
    `;
  } else {
    await sql`
      UPDATE fmm_license_activations SET last_validated_at = NOW() WHERE key_id = ${key.id}
    `;
  }

  return jsonResponse({ level: key.level, expires_at: key.expires_at, key_prefix: key.key_prefix });
};
