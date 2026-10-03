import { sql, type ElfSql } from './lib/db';
import { ApiError, errorResponse, jsonResponse, withElf } from './lib/http';
import { requireElfSession } from './lib/session';

type Deps = { requireSession?: typeof requireElfSession; sql?: ElfSql };

/** GET /api/elf/auth/me — usuário e sessão atuais. */
export async function handleAuthMe(req: Request, deps: Deps = {}): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400), req);
  }
  const auth = await (deps.requireSession ?? requireElfSession)(req);
  if (!auth.ok) {
    return errorResponse(new ApiError(auth.code, 'Sessão inválida.', auth.status), req);
  }

  const query = deps.sql ?? sql;
  const rows = await query<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    device_name: string;
    expires_at: Date | string;
  }>`
    SELECT u.id, u.display_name, u.avatar_url, d.name AS device_name, s.expires_at
      FROM elf_sessions s
      JOIN users u   ON u.id = s.user_id
      JOIN devices d ON d.id = s.device_id AND d.user_id = s.user_id
     WHERE s.id = ${auth.session.id} AND s.user_id = ${auth.session.userId}
     LIMIT 1`;

  const row = rows[0];
  if (!row) {
    return errorResponse(new ApiError('UNAUTHENTICATED', 'Sessão inválida.', 401), req);
  }

  return jsonResponse(
    {
      user: { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url },
      session: {
        platform: auth.session.platform,
        deviceName: row.device_name,
        expiresAt: new Date(row.expires_at).toISOString(),
      },
    },
    200,
    req,
  );
}

export default withElf((req) => handleAuthMe(req));
