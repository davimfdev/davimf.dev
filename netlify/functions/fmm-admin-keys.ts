import { Context } from '@netlify/functions';
import { sql, jsonResponse, errorResponse } from './lib/fmm-license.js';

const ADMIN_IDS = new Set(['956985471332937778', '344214477069221888']);

async function getDiscordId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const res = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: auth } });
    if (!res.ok) return null;
    const u = await res.json();
    return ADMIN_IDS.has(u.id) ? u.id : null;
  } catch { return null; }
}

export default async (req: Request, _context: Context) => {
  const adminId = await getDiscordId(req);
  if (!adminId) return errorResponse('Acesso negado', 403);

  // GET — list all keys with activation status
  if (req.method === 'GET') {
    const keys = await sql`
      SELECT
        k.id, k.key_prefix, k.level, k.duration_days, k.expires_at,
        k.is_active, k.notes, k.discord_user_id, k.created_at,
        a.hwid_hash IS NOT NULL AS is_claimed,
        a.last_validated_at
      FROM fmm_license_keys k
      LEFT JOIN fmm_license_activations a ON a.key_id = k.id
      ORDER BY k.created_at DESC
    `;
    return jsonResponse(keys);
  }

  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  let body: { action?: string; key_id?: number; duration_days?: number };
  try { body = await req.json(); } catch { return errorResponse('JSON inválido'); }

  const { action, key_id } = body;
  if (!action || !key_id) return errorResponse('action e key_id obrigatórios');

  switch (action) {
    case 'unclaim': {
      await sql`DELETE FROM fmm_license_activations WHERE key_id = ${key_id}`;
      return jsonResponse({ ok: true, action: 'unclaim', key_id });
    }

    case 'revoke': {
      const r = await sql`
        UPDATE fmm_license_keys SET is_active = false WHERE id = ${key_id} RETURNING id
      `;
      if (!r.length) return errorResponse('Chave não encontrada', 404);
      return jsonResponse({ ok: true, action: 'revoke', key_id });
    }

    case 'reactivate': {
      const r = await sql`
        UPDATE fmm_license_keys SET is_active = true WHERE id = ${key_id} RETURNING id
      `;
      if (!r.length) return errorResponse('Chave não encontrada', 404);
      return jsonResponse({ ok: true, action: 'reactivate', key_id });
    }

    case 'set_duration': {
      const { duration_days } = body;
      if (!duration_days || duration_days < 1) return errorResponse('duration_days inválido');
      const lifetime = duration_days >= 36500;
      const expiresAt = lifetime ? null : new Date();
      if (expiresAt) expiresAt.setDate(expiresAt.getDate() + duration_days);
      const expiresIso = expiresAt ? expiresAt.toISOString() : null;
      const r = await sql`
        UPDATE fmm_license_keys
        SET duration_days = ${duration_days}, expires_at = ${expiresIso}
        WHERE id = ${key_id}
        RETURNING id
      `;
      if (!r.length) return errorResponse('Chave não encontrada', 404);
      return jsonResponse({ ok: true, action: 'set_duration', key_id, duration_days, expires_at: expiresIso });
    }

    default:
      return errorResponse(`Ação desconhecida: ${action}`);
  }
};
