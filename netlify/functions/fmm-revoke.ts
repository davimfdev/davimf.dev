import { Context } from '@netlify/functions';
import { sql, verifyAdminSecret, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);
  if (!verifyAdminSecret(req)) return errorResponse('Unauthorized', 401);

  let body: { key_prefix?: string };
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON'); }

  if (!body.key_prefix) return errorResponse('key_prefix required');

  const result = await sql`
    UPDATE fmm_license_keys SET is_active = false
    WHERE key_prefix = ${body.key_prefix} AND is_active = true
    RETURNING id
  `;

  if (result.length === 0) return errorResponse('Key not found or already revoked', 404);
  return jsonResponse({ revoked: true, key_prefix: body.key_prefix });
};
