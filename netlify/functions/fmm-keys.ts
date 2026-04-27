import { Context } from '@netlify/functions';
import { sql, verifyAdminSecret, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);
  if (!verifyAdminSecret(req)) return errorResponse('Unauthorized', 401);

  const rows = await sql`
    SELECT
      k.key_prefix, k.level, k.duration_days,
      k.created_at, k.expires_at, k.is_active, k.notes,
      a.hwid_hash, a.activated_at, a.last_validated_at
    FROM fmm_license_keys k
    LEFT JOIN fmm_license_activations a ON a.key_id = k.id
    ORDER BY k.created_at DESC
  `;

  return jsonResponse({ keys: rows });
};
