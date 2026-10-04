import { describe, it, expect, vi } from 'vitest';
import { hashToken } from '../lib/crypto';
import { withElf } from '../lib/http';
import { generatePollToken, signPollToken, encryptSessionToken } from '../lib/pairing';
import { handleDevicePoll } from '../auth-device-poll';

const SESSAO = 'sessao.assinada';
const token = generatePollToken();
const assinado = signPollToken(token);

const req = (body: unknown = { pollToken: assinado }) =>
  new Request('https://elf.davimf.dev/api/elf/auth/device/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const linha = (over: Record<string, unknown> = {}) => ({
  id: 'pair-1',
  approved_user_id: 'user-1',
  session_ciphertext: encryptSessionToken(SESSAO, 'pair-1'),
  expires_at: new Date(Date.now() + 60_000),
  consumed_at: null,
  display_name: 'Davi',
  avatar_url: null,
  ...over,
});

function deps(rows: unknown[]) {
  const executados: Array<{ text: string; values: unknown[] }> = [];
  const tx = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    executados.push({ text, values });
    return text.includes('FROM device_pairings') ? rows : [];
  });
  return {
    executados,
    withTransaction: vi.fn(async (fn: (t: never) => Promise<unknown>) => fn(tx as never)),
    enforceRateLimit: vi.fn(async () => {}),
  };
}

const run = (request: Request, d: ReturnType<typeof deps>) =>
  withElf((r) => handleDevicePoll(r, d as never))(request);

const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('handleDevicePoll', () => {
  it('responde 428 PAIRING_PENDING enquanto não aprovado', async () => {
    const res = await run(req(), deps([linha({ approved_user_id: null, session_ciphertext: null })]));
    expect(res.status).toBe(428);
    expect(await codeOf(res)).toBe('PAIRING_PENDING');
  });

  it('responde 410 PAIRING_EXPIRED quando expirado', async () => {
    const res = await run(req(), deps([linha({ expires_at: new Date(Date.now() - 1000) })]));
    expect(res.status).toBe(410);
    expect(await codeOf(res)).toBe('PAIRING_EXPIRED');
  });

  it('responde 409 PAIRING_ALREADY_USED quando já coletado', async () => {
    const res = await run(req(), deps([linha({ consumed_at: new Date() })]));
    expect(res.status).toBe(409);
    expect(await codeOf(res)).toBe('PAIRING_ALREADY_USED');
  });

  it('responde 404 para pollToken desconhecido', async () => {
    const res = await run(req(), deps([]));
    expect(res.status).toBe(404);
  });

  it('recusa pollToken com assinatura inválida sem consultar o banco', async () => {
    const d = deps([linha()]);
    const res = await run(req({ pollToken: `${assinado}x` }), d);
    expect(res.status).toBe(404);
    expect(d.withTransaction).not.toHaveBeenCalled();
  });

  it('busca pelo hash do pollToken, nunca pelo valor em claro', async () => {
    const d = deps([linha()]);
    await run(req(), d);
    expect(d.executados[0]?.values).toEqual([hashToken(token)]);
  });

  it('entrega a sessão e o usuário quando aprovado', async () => {
    const res = await run(req(), deps([linha()]));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sessionToken).toBe(SESSAO);
    expect(body.user).toEqual({ id: 'user-1', displayName: 'Davi', avatarUrl: null });
  });

  it('marca como consumido e apaga o ciphertext na entrega', async () => {
    const d = deps([linha()]);
    await run(req(), d);
    const update = d.executados.find((e) => e.text.includes('UPDATE device_pairings'));
    expect(update?.text).toContain('consumed_at = NOW()');
    expect(update?.text).toContain('session_ciphertext = NULL');
  });

  it('não entrega sessão com ciphertext de outro pareamento', async () => {
    const res = await run(
      req(),
      deps([linha({ session_ciphertext: encryptSessionToken(SESSAO, 'pair-outro') })]),
    );
    expect(res.status).toBe(404);
  });

  it('limita a uma consulta a cada 2 segundos por pareamento', async () => {
    const d = deps([linha()]);
    await run(req(), d);
    expect(d.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'device_poll', limit: 1, windowSeconds: 2 }),
    );
  });

  it('recusa campo desconhecido no corpo', async () => {
    const res = await run(req({ pollToken: assinado, code: 'K7M2QX' }), deps([linha()]));
    expect(res.status).toBe(400);
  });
});
