import { Context } from '@netlify/functions';
import { sql, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') return errorResponse('Method Not Allowed', 405);

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token não fornecido', 401);

  const discordRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: authHeader },
  });
  if (!discordRes.ok) return errorResponse('Token Discord inválido', 401);
  const user = await discordRes.json();

  const keys = await sql`
    SELECT key_prefix, level, duration_days, expires_at, notes, created_at
    FROM fmm_license_keys
    WHERE discord_user_id = ${user.id}
    ORDER BY created_at DESC
  `;

  return jsonResponse(keys);
};
