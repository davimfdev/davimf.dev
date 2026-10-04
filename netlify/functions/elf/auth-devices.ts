import { writeAudit } from './lib/audit';
import {
  sql,
  withTransaction as defaultWithTransaction,
  type ElfSql,
  type ElfTransaction,
} from './lib/db';
import { ApiError, jsonResponse, requireAllowedOrigin, withElf, type ElfContext } from './lib/http';
import { enforceRouteRateLimit as defaultRouteLimit } from './lib/rate-limit';
import { requireElfSession } from './lib/session';
import { isResourceId } from './lib/validation';

type Deps = {
  requireSession?: typeof requireElfSession;
  withTransaction?: ElfTransaction;
  enforceRouteRateLimit?: typeof defaultRouteLimit;
  sql?: ElfSql;
};

const notFound = () => new ApiError('DEVICE_NOT_FOUND', 'Dispositivo não encontrado.', 404);

/**
 * GET /api/elf/auth/devices e DELETE /api/elf/auth/devices/:id.
 * Revogar sessão encerra um acesso; revogar dispositivo corta o aparelho
 * inteiro, com todas as sessões dele. É o que se usa ao perder o celular.
 */
export async function handleDevices(
  req: Request,
  params: { id?: string },
  ctx: ElfContext,
  deps: Deps = {},
): Promise<Response> {
  const auth = await (deps.requireSession ?? requireElfSession)(req);
  if (!auth.ok) throw new ApiError(auth.code, 'Sessão inválida.', auth.status);
  const { userId } = auth.session;

  if (req.method === 'GET') {
    await (deps.enforceRouteRateLimit ?? defaultRouteLimit)(req, userId);
    const rows = await (deps.sql ?? sql)<{
      id: string;
      name: string;
      platform: string;
      created_at: Date | string;
      last_seen_at: Date | string;
      active_sessions: number;
    }>`
      SELECT d.id, d.name, d.platform, d.created_at, d.last_seen_at,
             COUNT(s.id) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > NOW())::int
               AS active_sessions
        FROM devices d
        LEFT JOIN elf_sessions s ON s.device_id = d.id AND s.user_id = d.user_id
       WHERE d.user_id = ${userId} AND d.revoked_at IS NULL
       GROUP BY d.id
       ORDER BY d.last_seen_at DESC`;

    return jsonResponse(
      {
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          platform: row.platform,
          createdAt: new Date(row.created_at).toISOString(),
          lastSeenAt: new Date(row.last_seen_at).toISOString(),
          activeSessionCount: row.active_sessions,
          isCurrent: row.id === auth.session.deviceId,
        })),
      },
      200,
      req,
    );
  }

  if (req.method === 'DELETE') {
    requireAllowedOrigin(req, auth.isCookieAuth);
    await (deps.enforceRouteRateLimit ?? defaultRouteLimit)(req, userId);
    if (!params.id) throw new ApiError('VALIDATION_FAILED', 'Id do dispositivo é obrigatório.', 400);
    const deviceId = params.id;
    if (!isResourceId(deviceId)) throw notFound();

    await (deps.withTransaction ?? defaultWithTransaction)(async (tx) => {
      const revoked = await tx<{ id: string }>`
        UPDATE devices SET revoked_at = NOW()
         WHERE id = ${deviceId} AND user_id = ${userId} AND revoked_at IS NULL
     RETURNING id`;
      // Dispositivo de outro dono responde 404, e nenhuma sessão é tocada.
      if (revoked.length === 0) throw notFound();

      // Cortar o aparelho derruba todas as sessões dele, na mesma transação.
      await tx`
        UPDATE elf_sessions SET revoked_at = NOW()
         WHERE device_id = ${deviceId} AND user_id = ${userId} AND revoked_at IS NULL`;

      await writeAudit(tx, {
        userId,
        deviceId: auth.session.deviceId,
        entity: 'device',
        entityId: deviceId,
        action: 'revoke',
        requestId: ctx.requestId,
      });
    });

    return jsonResponse({ ok: true }, 200, req);
  }

  throw new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400);
}

export default withElf((req, ctx) => {
  const [, id] = new URL(req.url).pathname.split('/api/elf/auth/devices');
  return handleDevices(req, { id: id?.replace(/^\/|\/$/g, '') || undefined }, ctx);
});
