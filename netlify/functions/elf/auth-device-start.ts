import { z } from 'zod';
import { hashToken } from './lib/crypto';
import { sql, type ElfSql } from './lib/db';
import { ApiError, jsonResponse, withElf } from './lib/http';
import { formatCode, generatePairingCode, generatePollToken, signPollToken } from './lib/pairing';
import { clientIp, enforceRateLimit as defaultEnforce, RATE_LIMITS } from './lib/rate-limit';
import { parseBody } from './lib/validation';

const PAIRING_TTL_MS = 5 * 60_000;

const BodySchema = z
  .object({
    deviceName: z.string().trim().min(1).max(120),
    platform: z.enum(['desktop', 'android']),
  })
  .strict();

type Deps = { sql?: ElfSql; enforceRateLimit?: typeof defaultEnforce };

/**
 * POST /api/elf/auth/device/start — rota PÚBLICA: quem chama ainda não tem
 * sessão. Por isso o rate limit é por IP. Devolve o código que o app mostra na
 * tela e o pollToken privado com que ele vai coletar a sessão.
 */
export async function handleDeviceStart(req: Request, deps: Deps = {}): Promise<Response> {
  if (req.method !== 'POST') {
    throw new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400);
  }

  await (deps.enforceRateLimit ?? defaultEnforce)({
    scope: 'device_start',
    identifier: clientIp(req),
    ...RATE_LIMITS.deviceStart,
  });

  const body = await parseBody(req, BodySchema);

  const code = generatePairingCode();
  const pollToken = generatePollToken();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();

  // Só os hashes vão para o banco. O código aparece numa tela, então não pode ser
  // a credencial: quem coleta a sessão é o pollToken, que nunca sai do app.
  await (deps.sql ?? sql)`
    INSERT INTO device_pairings (code_hash, poll_token_hash, device_name, platform, expires_at)
    VALUES (${hashToken(code)}, ${hashToken(pollToken)}, ${body.deviceName}, ${body.platform}, ${expiresAt})`;

  return jsonResponse(
    {
      code: formatCode(code),
      pollToken: signPollToken(pollToken),
      expiresAt,
      verificationUrl: `${new URL(req.url).origin}/parear`,
    },
    201,
    req,
  );
}

export default withElf((req) => handleDeviceStart(req));
