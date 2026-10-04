import { z } from 'zod';
import { writeAudit } from './lib/audit';
import { hashToken } from './lib/crypto';
import { withTransaction as defaultWithTransaction, type ElfTransaction } from './lib/db';
import { ApiError, jsonResponse, requireAllowedOrigin, withElf, type ElfContext } from './lib/http';
import { encryptSessionToken, normalizeCode, PAIRING_CODE_PATTERN } from './lib/pairing';
import { enforceRateLimit as defaultEnforce, RATE_LIMITS } from './lib/rate-limit';
import { createElfSession, requireElfSession } from './lib/session';
import { parseBody } from './lib/validation';

const BodySchema = z.object({ code: z.string().min(6).max(9) }).strict();

type Deps = {
  requireSession?: typeof requireElfSession;
  withTransaction?: ElfTransaction;
  enforceRateLimit?: typeof defaultEnforce;
  createSession?: typeof createElfSession;
};

/**
 * POST /api/elf/auth/device/approve — o usuário, logado na web, digita o código
 * que o app mostra. Cria o dispositivo e a sessão dele, e deixa o token cifrado
 * esperando o app coletar com o pollToken.
 */
export async function handleDeviceApprove(
  req: Request,
  ctx: ElfContext,
  deps: Deps = {},
): Promise<Response> {
  if (req.method !== 'POST') {
    throw new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400);
  }

  const auth = await (deps.requireSession ?? requireElfSession)(req);
  if (!auth.ok) throw new ApiError(auth.code, 'Sessão inválida.', auth.status);
  const { userId } = auth.session;

  requireAllowedOrigin(req, auth.isCookieAuth);

  // A proteção contra adivinhar códigos é este limite por usuário somado ao
  // código de uso único e de 5 minutos: ~887 milhões de combinações.
  await (deps.enforceRateLimit ?? defaultEnforce)({
    scope: 'device_approve',
    identifier: userId,
    ...RATE_LIMITS.deviceApprove,
  });

  const body = await parseBody(req, BodySchema);
  const code = normalizeCode(body.code);
  if (!PAIRING_CODE_PATTERN.test(code)) {
    throw new ApiError('VALIDATION_FAILED', 'Código inválido.', 400);
  }

  const runTransaction = deps.withTransaction ?? defaultWithTransaction;
  const makeSession = deps.createSession ?? createElfSession;

  const approved = await runTransaction(async (tx) => {
    // `approved_user_id IS NULL`: um código já aprovado não pode ser aprovado de
    // novo por outra conta antes da coleta. FOR UPDATE serializa aprovações simultâneas.
    const [pairing] = await tx<{ id: string; device_name: string; platform: 'desktop' | 'android' }>`
      SELECT id, device_name, platform
        FROM device_pairings
       WHERE code_hash = ${hashToken(code)}
         AND consumed_at IS NULL AND approved_user_id IS NULL AND expires_at > NOW()
       FOR UPDATE`;
    if (!pairing) {
      throw new ApiError('PAIRING_NOT_FOUND', 'Código não encontrado ou expirado.', 404);
    }

    const [device] = await tx<{ id: string }>`
      INSERT INTO devices (user_id, name, platform)
      VALUES (${userId}, ${pairing.device_name}, ${pairing.platform})
      RETURNING id`;
    if (!device) throw new Error('INSERT em devices não devolveu id');

    const sessionToken = await makeSession(
      { userId, deviceId: device.id, platform: pairing.platform },
      { sql: tx },
    );

    await tx`
      UPDATE device_pairings
         SET approved_user_id = ${userId},
             session_ciphertext = ${encryptSessionToken(sessionToken, pairing.id)}
       WHERE id = ${pairing.id}`;

    await writeAudit(tx, {
      userId,
      deviceId: device.id,
      entity: 'device',
      entityId: device.id,
      action: 'approve',
      after: { name: pairing.device_name, platform: pairing.platform },
      requestId: ctx.requestId,
    });

    return { deviceName: pairing.device_name, platform: pairing.platform };
  });

  return jsonResponse(approved, 200, req);
}

export default withElf((req, ctx) => handleDeviceApprove(req, ctx));
