import { sql, type ElfSql } from './lib/db';
import { ApiError, jsonResponse, requireAllowedOrigin, withElf } from './lib/http';
import { enforceRouteRateLimit as defaultRouteLimit } from './lib/rate-limit';
import { requireElfSession, revokeSessionById } from './lib/session';
import { isResourceId } from './lib/validation';

type Deps = {
  requireSession?: typeof requireElfSession;
  revoke?: typeof revokeSessionById;
  enforceRouteRateLimit?: typeof defaultRouteLimit;
  sql?: ElfSql;
};

const notFound = () => new ApiError('SESSION_NOT_FOUND', 'Sessão não encontrada.', 404);

/**
 * GET /api/elf/auth/sessions e DELETE /api/elf/auth/sessions/:id.
 * O `:id` é `elf_sessions.id`, nunca `session_id_hash`: um é identificador de
 * recurso, o outro é credencial.
 */
export async function handleSessions(
  req: Request,
  params: { id?: string },
  deps: Deps = {},
): Promise<Response> {
  const auth = await (deps.requireSession ?? requireElfSession)(req);
  if (!auth.ok) throw new ApiError(auth.code, 'Sessão inválida.', auth.status);
  const { userId } = auth.session;

  if (req.method === 'GET') {
    await (deps.enforceRouteRateLimit ?? defaultRouteLimit)(req, userId);
    const rows = await (deps.sql ?? sql)<{
      id: string;
      platform: string;
      device_name: string;
      created_at: Date | string;
      last_used_at: Date | string;
    }>`
      SELECT s.id, s.platform, d.name AS device_name, s.created_at, s.last_used_at
        FROM elf_sessions s
        JOIN devices d ON d.id = s.device_id AND d.user_id = s.user_id
       WHERE s.user_id = ${userId}
         AND s.revoked_at IS NULL AND s.expires_at > NOW()
       ORDER BY s.last_used_at DESC`;

    return jsonResponse(
      {
        data: rows.map((row) => ({
          id: row.id,
          platform: row.platform,
          deviceName: row.device_name,
          createdAt: new Date(row.created_at).toISOString(),
          lastUsedAt: new Date(row.last_used_at).toISOString(),
          isCurrent: row.id === auth.session.id,
        })),
      },
      200,
      req,
    );
  }

  if (req.method === 'DELETE') {
    requireAllowedOrigin(req, auth.isCookieAuth);
    await (deps.enforceRouteRateLimit ?? defaultRouteLimit)(req, userId);
    if (!params.id) throw new ApiError('VALIDATION_FAILED', 'Id da sessão é obrigatório.', 400);
    if (!isResourceId(params.id)) throw notFound();

    // revokeSessionById filtra por user_id: sessão de outro dono não é tocada e
    // responde 404, porque 403 confirmaria que o id existe.
    const revoked = await (deps.revoke ?? revokeSessionById)(params.id, userId);
    if (!revoked) throw notFound();
    return jsonResponse({ ok: true }, 200, req);
  }

  throw new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400);
}

export default withElf((req) => {
  const [, id] = new URL(req.url).pathname.split('/api/elf/auth/sessions');
  return handleSessions(req, { id: id?.replace(/^\/|\/$/g, '') || undefined });
});
