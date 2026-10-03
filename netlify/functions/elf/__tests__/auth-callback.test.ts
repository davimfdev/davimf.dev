import { describe, it, expect, vi } from 'vitest';
import { createOAuthState, ELF_OAUTH_STATE_COOKIE } from '../lib/oauth-state';
import { handleAuthCallback } from '../auth-callback';

const CTX = { requestId: 'req-1' };
const state = createOAuthState('/contas');

const req = (over: { code?: string | null; cookie?: string } = {}) => {
  const url = new URL('https://elf.davimf.dev/api/elf/auth/callback');
  if (over.code !== null) url.searchParams.set('code', over.code ?? 'codigo-valido');
  url.searchParams.set('state', state);
  return new Request(url, {
    headers: { cookie: over.cookie ?? `${ELF_OAUTH_STATE_COOKIE}=${state}` },
  });
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const discordOk = async (input: RequestInfo | URL) =>
  String(input).includes('/oauth2/token')
    ? json({ access_token: 'opaco', expires_in: 604800 })
    : json({ id: '123456789012345678', global_name: 'Davi', avatar: 'abc123' });

/** Transação falsa: devolve um usuário para o upsert e registra os SQLs executados. */
function fakeTransaction() {
  const statements: string[] = [];
  const tx = vi.fn(async (strings: TemplateStringsArray) => {
    statements.push(strings.join('?'));
    return [{ id: 'user-1' }];
  });
  const run = vi.fn(async (fn: (t: never) => Promise<unknown>) => fn(tx as never));
  return { run, tx, statements };
}

const depsOk = (over: Record<string, unknown> = {}) => ({
  fetchImpl: discordOk as never,
  withTransaction: fakeTransaction().run as never,
  resolveWebDevice: (async () => ({ deviceId: 'dev-1', isNew: true })) as never,
  createSession: (async () => 'sessao.assinada') as never,
  seed: (async () => 16) as never,
  ...over,
});

const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('handleAuthCallback', () => {
  it('recusa state divergente do cookie', async () => {
    const res = await handleAuthCallback(
      req({ cookie: `${ELF_OAUTH_STATE_COOKIE}=${createOAuthState('/outro')}` }),
      CTX,
      depsOk(),
    );
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('OAUTH_STATE_INVALID');
  });

  it('recusa requisição sem code', async () => {
    const res = await handleAuthCallback(req({ code: null }), CTX, depsOk());
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('OAUTH_STATE_INVALID');
  });

  it('recusa quando a troca falha no Discord, sem tocar no banco', async () => {
    const transaction = fakeTransaction();
    await expect(
      handleAuthCallback(
        req(),
        CTX,
        depsOk({
          fetchImpl: async () => new Response('erro', { status: 401 }),
          withTransaction: transaction.run,
        }),
      ),
    ).rejects.toMatchObject({ code: 'OAUTH_EXCHANGE_FAILED', status: 400 });
    expect(transaction.run).not.toHaveBeenCalled();
  });

  it('recusa identidade sem id numérico do Discord', async () => {
    const fetchImpl = async (input: RequestInfo | URL) =>
      String(input).includes('/oauth2/token') ? json({ access_token: 'x' }) : json({ id: 'abc' });
    await expect(handleAuthCallback(req(), CTX, depsOk({ fetchImpl }))).rejects.toMatchObject({
      code: 'OAUTH_EXCHANGE_FAILED',
    });
  });

  it('redireciona para o returnTo em caso de sucesso', async () => {
    const res = await handleAuthCallback(req(), CTX, depsOk());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/contas');
  });

  it('seta cookie de sessão HttpOnly e limpa o state', async () => {
    const cookies = (await handleAuthCallback(req(), CTX, depsOk())).headers.getSetCookie();
    expect(cookies.find((c) => c.startsWith('elf_session=sessao.assinada'))).toContain('HttpOnly');
    expect(cookies.find((c) => c.startsWith(`${ELF_OAUTH_STATE_COOKIE}=;`))).toContain('Expires=');
  });

  it('seta o cookie de dispositivo', async () => {
    const cookies = (await handleAuthCallback(req(), CTX, depsOk())).headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('elf_device='))).toBe(true);
  });

  it('nunca coloca credencial na URL de retorno', async () => {
    const location = (await handleAuthCallback(req(), CTX, depsOk())).headers.get('Location');
    expect(location).toBe('/contas');
  });

  it('faz upsert do usuário pelo id do Discord', async () => {
    const transaction = fakeTransaction();
    await handleAuthCallback(req(), CTX, depsOk({ withTransaction: transaction.run }));
    expect(transaction.statements[0]).toContain('ON CONFLICT (discord_user_id)');
    expect(transaction.tx.mock.calls[0]?.slice(1)).toEqual([
      '123456789012345678',
      'Davi',
      'https://cdn.discordapp.com/avatars/123456789012345678/abc123.png',
    ]);
  });

  it('roda dispositivo, seed e sessão dentro da mesma transação', async () => {
    const transaction = fakeTransaction();
    const seed = vi.fn(async () => 0);
    const createSession = vi.fn(async () => 'sessao.assinada');
    await handleAuthCallback(
      req(),
      CTX,
      depsOk({ withTransaction: transaction.run, seed, createSession }),
    );
    expect(seed).toHaveBeenCalledWith(transaction.tx, {
      userId: 'user-1',
      deviceId: 'dev-1',
      requestId: 'req-1',
    });
    expect(createSession).toHaveBeenCalledWith(
      { userId: 'user-1', deviceId: 'dev-1', platform: 'web' },
      { sql: transaction.tx },
    );
  });

  it('propaga a falha da transação em vez de redirecionar', async () => {
    const failing = async () => {
      throw new Error('falha no banco');
    };
    await expect(
      handleAuthCallback(req(), CTX, depsOk({ withTransaction: failing })),
    ).rejects.toThrow('falha no banco');
  });
});
