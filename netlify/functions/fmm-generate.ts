import { Context } from '@netlify/functions';
import {
  sql, verifyAdminSecret, generateKeyString,
  sha256Hex, jsonResponse, errorResponse,
} from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);
  if (!verifyAdminSecret(req)) return errorResponse('Unauthorized', 401);

  let body: { level?: string; duration_days?: number; notes?: string };
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON'); }

  const { level, duration_days, notes } = body;
  if (!level || !['basic', 'pro'].includes(level)) return errorResponse('level must be basic or pro');
  if (!duration_days || typeof duration_days !== 'number' || duration_days < 1)
    return errorResponse('duration_days must be a positive number');

  const rawKey = generateKeyString();
  const keyHash = sha256Hex(rawKey);
  const keyPrefix = rawKey.substring(0, 12); // "FMM-XXXXXXXX"

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + duration_days);

  await sql`
    INSERT INTO fmm_license_keys (key_hash, key_prefix, level, duration_days, expires_at, notes)
    VALUES (${keyHash}, ${keyPrefix}, ${level}, ${duration_days},
            ${expiresAt.toISOString()}, ${notes ?? null})
  `;

  return jsonResponse(
    { key: rawKey, level, expires_at: expiresAt.toISOString(), key_prefix: keyPrefix },
    201
  );
};
