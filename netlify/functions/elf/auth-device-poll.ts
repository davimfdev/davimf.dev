import { z } from 'zod';
import { hashToken } from './lib/crypto';
import { withTransaction as defaultWithTransaction, type ElfTransaction } from './lib/db';
import { ApiError, jsonResponse, withElf } from './lib/http';
import { decryptSessionToken, verifyPollToken } from './lib/pairing';
import { enforceRateLimit as defaultEnforce, RATE_LIMITS } from './lib/rate-limit';
import { parseBody } from './lib/validation';

const BodySchema = z.object({ pollToken: z.string().min(1).max(256) }).strict();

type Deps = { withTransaction?: ElfTransaction; enforceRateLimit?: typeof defaultEnforce };

const notFound = () => new ApiError('PAIRING_NOT_FOUND', 'Pareamento não encontrado.', 404);

/**
 * POST /api/elf/auth/device/poll — o app pergunta se já foi aprovado. Só quem tem
 * o pollToken coleta: o código visível na tela não basta. A sessão é entregue
 * uma única vez, e o ciphertext é apagado na mesma transação da entrega.
 */
export async function handleDevicePoll(req: Request, deps: Deps = {}): Promise<Response> {
  if (req.method !== 'POST') {
    throw new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400);
  }

  const body = await parseBody(req, BodySchema);
  const pollToken = verifyPollToken(body.pollToken);
  if (!pollToken) throw notFound();
  const pollTokenHash = hashToken(pollToken);

  await (deps.enforceRateLimit ?? defaultEnforce)({
    scope: 'device_poll',
    identifier: pollTokenHash,
    ...RATE_LIMITS.devicePoll,
  });

  const collected = await (deps.withTransaction ?? defaultWithTransaction)(async (tx) => {
    const [pairing] = await tx<{
      id: string;
      approved_user_id: string | null;
      session_ciphertext: string | null;
      expires_at: Date | string;
      consumed_at: Date | string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>`
      SELECT p.id, p.approved_user_id, p.session_ciphertext, p.expires_at, p.consumed_at,
             u.display_name, u.avatar_url
        FROM device_pairings p
        LEFT JOIN users u ON u.id = p.approved_user_id
       WHERE p.poll_token_hash = ${pollTokenHash}
       FOR UPDATE OF p`;

    if (!pairing) throw notFound();
    if (pairing.consumed_at) {
      throw new ApiError('PAIRING_ALREADY_USED', 'Pareamento já utilizado.', 409);
    }
    if (new Date(pairing.expires_at).getTime() <= Date.now()) {
      throw new ApiError('PAIRING_EXPIRED', 'Pareamento expirado.', 410);
    }
    if (!pairing.approved_user_id || !pairing.session_ciphertext) {
      throw new ApiError('PAIRING_PENDING', 'Aguardando aprovação.', 428);
    }

    let sessionToken: string;
    try {
      sessionToken = decryptSessionToken(pairing.session_ciphertext, pairing.id);
    } catch (error) {
      // Falha de autenticação do GCM: ciphertext adulterado nunca vira sessão.
      console.error('[elf] ciphertext de pareamento inválido', {
        pairingId: pairing.id,
        message: error instanceof Error ? error.message : 'desconhecido',
      });
      throw notFound();
    }

    await tx`
      UPDATE device_pairings
         SET consumed_at = NOW(), session_ciphertext = NULL
       WHERE id = ${pairing.id}`;

    return {
      sessionToken,
      user: {
        id: pairing.approved_user_id,
        displayName: pairing.display_name,
        avatarUrl: pairing.avatar_url,
      },
    };
  });

  return jsonResponse(collected, 200, req);
}

export default withElf((req) => handleDevicePoll(req));
