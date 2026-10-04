import { describe, it, expect, vi } from 'vitest';
import { withElf } from '../lib/http';
import { decryptSessionToken } from '../lib/pairing';
import { handleDeviceApprove } from '../auth-device-approve';

const req = (body: unknown, origin = 'https://elf.davimf.dev') =>
  new Request('https://elf.davimf.dev/api/elf/auth/device/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });

const sessao = (isCookieAuth = true) => ({
  ok: true as const,
  isCookieAuth,
  session: { id: 'sess-1', userId: 'user-1', deviceId: 'dev-web', platform: 'web' as const },
});

const pareamento = { id: 'pair-1', device_name: 'Notebook do Davi', platform: 'desktop' };

/** Transação falsa: responde por trecho de SQL e registra o que foi executado. */
function transacao(pairingRows: unknown[] = [pareamento]) {
  const executados: Array<{ text: string; values: unknown[] }> = [];
  const tx = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    executados.push({ text, values });
    if (text.includes('FROM device_pairings')) return pairingRows;
    if (text.includes('INSERT INTO devices')) return [{ id: 'dev-novo' }];
    return [];
  });
  const run = vi.fn(async (fn: (t: never) => Promise<unknown>) => fn(tx as never));
  return { run, tx, executados };
}

function depsOk(pairingRows?: unknown[]) {
  const transaction = transacao(pairingRows);
  return {
    transaction,
    deps: {
      requireSession: vi.fn(async () => sessao()),
      enforceRateLimit: vi.fn(async () => {}),
      withTransaction: transaction.run,
      createSession: vi.fn(async () => 'sessao.assinada'),
    },
  };
}

const run = (request: Request, deps: Record<string, unknown>) =>
  withElf((r, ctx) => handleDeviceApprove(r, ctx, deps as never))(request);

const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('handleDeviceApprove', () => {
  it('responde 401 sem sessão', async () => {
    const { deps } = depsOk();
    deps.requireSession.mockResolvedValueOnce({ ok: false, status: 401, code: 'UNAUTHENTICATED' } as never);
    const res = await run(req({ code: 'K7M-2QX' }), deps);
    expect(res.status).toBe(401);
  });

  it('recusa origem não permitida em sessão por cookie, sem tocar no banco', async () => {
    const { deps, transaction } = depsOk();
    const res = await run(req({ code: 'K7M-2QX' }, 'https://evil.example'), deps);
    expect(res.status).toBe(403);
    expect(transaction.run).not.toHaveBeenCalled();
  });

  it('aprova e devolve o dispositivo confirmado', async () => {
    const { deps } = depsOk();
    const res = await run(req({ code: 'K7M-2QX' }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deviceName: 'Notebook do Davi', platform: 'desktop' });
  });

  it('aceita código em minúsculas e sem hífen, buscando pelo hash normalizado', async () => {
    const { deps, transaction } = depsOk();
    const res = await run(req({ code: 'k7m2qx' }), deps);
    expect(res.status).toBe(200);
    const select = transaction.executados[0];
    expect(select?.text).toContain('approved_user_id IS NULL');
    expect(select?.values[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cria dispositivo e sessão do usuário logado, na plataforma do pareamento', async () => {
    const { deps, transaction } = depsOk();
    await run(req({ code: 'K7M-2QX' }), deps);
    expect(deps.createSession).toHaveBeenCalledWith(
      { userId: 'user-1', deviceId: 'dev-novo', platform: 'desktop' },
      { sql: transaction.tx },
    );
  });

  it('guarda o token cifrado com o id do pareamento como AAD', async () => {
    const { deps, transaction } = depsOk();
    await run(req({ code: 'K7M-2QX' }), deps);
    const update = transaction.executados.find((e) => e.text.includes('UPDATE device_pairings'));
    const ciphertext = String(update?.values[1]);
    expect(ciphertext).not.toContain('sessao.assinada');
    expect(decryptSessionToken(ciphertext, 'pair-1')).toBe('sessao.assinada');
  });

  it('audita a aprovação dentro da transação', async () => {
    const { deps, transaction } = depsOk();
    await run(req({ code: 'K7M-2QX' }), deps);
    expect(transaction.executados.some((e) => e.text.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('responde 404 quando o código não existe, expirou ou já foi aprovado', async () => {
    const { deps } = depsOk([]);
    const res = await run(req({ code: 'K7M-2QX' }), deps);
    expect(res.status).toBe(404);
    expect(await codeOf(res)).toBe('PAIRING_NOT_FOUND');
  });

  it('recusa código com caractere ambíguo', async () => {
    const { deps } = depsOk();
    const res = await run(req({ code: 'K7M-2Q0' }), deps);
    expect(res.status).toBe(400);
  });

  it('recusa campo desconhecido', async () => {
    const { deps } = depsOk();
    const res = await run(req({ code: 'K7M-2QX', userId: 'outro' }), deps);
    expect(res.status).toBe(400);
  });

  it('limita por usuário', async () => {
    const { deps } = depsOk();
    await run(req({ code: 'K7M-2QX' }), deps);
    expect(deps.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'device_approve', identifier: 'user-1', limit: 10 }),
    );
  });

  it('nunca devolve o token de sessão na resposta da aprovação', async () => {
    const { deps } = depsOk();
    const res = await run(req({ code: 'K7M-2QX' }), deps);
    expect(JSON.stringify(await res.json())).not.toContain('sessao.assinada');
  });
});
