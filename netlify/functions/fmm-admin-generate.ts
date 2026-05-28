import { Context } from '@netlify/functions';
import { sql, generateKeyString, sha256Hex, jsonResponse, errorResponse } from './lib/fmm-license.js';

const ADMIN_IDS = new Set(['956985471332937778', '344214477069221888']);

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token não fornecido', 401);

  const discordRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: authHeader },
  });
  if (!discordRes.ok) return errorResponse('Token Discord inválido', 401);
  const user = await discordRes.json();

  if (!ADMIN_IDS.has(user.id)) return errorResponse('Acesso negado', 403);

  let body: { level?: string; duration_days?: number; quantity?: number };
  try { body = await req.json(); } catch { return errorResponse('JSON inválido'); }

  const { level, duration_days, quantity = 1 } = body;
  if (!level || !['basic', 'pro'].includes(level)) return errorResponse('level deve ser basic ou pro');
  if (!duration_days || typeof duration_days !== 'number' || duration_days < 1)
    return errorResponse('duration_days deve ser número positivo');
  if (quantity < 1 || quantity > 50) return errorResponse('quantity deve ser entre 1 e 50');

  const keys: string[] = [];

  for (let i = 0; i < quantity; i++) {
    const rawKey = generateKeyString();
    const keyHash = sha256Hex(rawKey);
    const keyPrefix = rawKey.substring(0, 12);
    const lifetime = duration_days >= 36500;
    const expiresAt = lifetime ? null : new Date();
    if (expiresAt) expiresAt.setDate(expiresAt.getDate() + duration_days);

    await sql`
      INSERT INTO fmm_license_keys (key_hash, key_prefix, level, duration_days, expires_at, notes, discord_user_id)
      VALUES (
        ${keyHash}, ${keyPrefix}, ${level}, ${duration_days},
        ${expiresAt ? expiresAt.toISOString() : null},
        ${`Admin: gerado por ${user.username} (${user.id})`},
        ${user.id}
      )
    `;
    keys.push(rawKey);
  }

  return jsonResponse({ keys, level, duration_days, expires_at: null }, 201);
};
