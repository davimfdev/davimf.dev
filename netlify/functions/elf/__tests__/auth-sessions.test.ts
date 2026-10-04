import { describe, it, expect, vi } from 'vitest';
import { withElf } from '../lib/http';
import { handleSessions } from '../auth-sessions';

const ATUAL = '11111111-1111-4111-8111-111111111111';
const OUTRA = '22222222-2222-4222-8222-222222222222';

const sessaoOk = {
  ok: true as const,
  isCookieAuth: true,
  session: { id: ATUAL, userId: 'user-1', deviceId: 'dev-1', platform: 'web' as const },
};

const get = () => new Request('https://elf.davimf.dev/api/elf/auth/sessions');
const del = (id: string, origin = 'https://elf.davimf.dev') =>
  new Request(`https://elf.davimf.dev/api/elf/auth/sessions/${id}`, {
    method: 'DELETE',
    headers: { origin },
  });

const linhas = () => [
  {
    id: ATUAL,
    platform: 'web',
    device_name: 'Chrome no Windows',
    created_at: new Date('2026-10-01T10:00:00Z'),
    last_used_at: new Date('2026-10-04T10:00:00Z'),
  },
  {
    id: OUTRA,
    platform: 'desktop',
    device_name: 'Notebook',
    created_at: new Date('2026-10-02T10:00:00Z'),
    last_used_at: new Date('2026-10-03T10:00:00Z'),
  },
];

function depsOk() {
  return {
    requireSession: vi.fn(async () => sessaoOk),
    revoke: vi.fn(async () => true),
    enforceRouteRateLimit: vi.fn(async () => {}),
    sql: vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>(async () => linhas()),
  };
}

const run = (request: Request, params: { id?: string }, deps: ReturnType<typeof depsOk>) =>
  withElf((r) => handleSessions(r, params, deps as never))(request);

describe('handleSessions', () => {
  it('responde 401 sem sessão', async () => {
    const deps = depsOk();
    deps.requireSession.mockResolvedValueOnce({ ok: false, status: 401, code: 'UNAUTHENTICATED' } as never);
    const res = await run(get(), {}, deps);
    expect(res.status).toBe(401);
  });

  it('lista as sessões ativas do usuário marcando a atual', async () => {
    const deps = depsOk();
    const res = await run(get(), {}, deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        {
          id: ATUAL,
          platform: 'web',
          deviceName: 'Chrome no Windows',
          createdAt: '2026-10-01T10:00:00.000Z',
          lastUsedAt: '2026-10-04T10:00:00.000Z',
          isCurrent: true,
        },
        {
          id: OUTRA,
          platform: 'desktop',
          deviceName: 'Notebook',
          createdAt: '2026-10-02T10:00:00.000Z',
          lastUsedAt: '2026-10-03T10:00:00.000Z',
          isCurrent: false,
        },
      ],
    });
    expect(deps.sql.mock.calls[0]?.slice(1)).toEqual(['user-1']);
  });

  it('revoga sessão específica do próprio usuário', async () => {
    const deps = depsOk();
    const res = await run(del(OUTRA), { id: OUTRA }, deps);
    expect(res.status).toBe(200);
    expect(deps.revoke).toHaveBeenCalledWith(OUTRA, 'user-1');
  });

  it('responde 404 SESSION_NOT_FOUND para sessão de outro usuário', async () => {
    const deps = depsOk();
    deps.revoke.mockResolvedValueOnce(false);
    const res = await run(del(OUTRA), { id: OUTRA }, deps);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('SESSION_NOT_FOUND');
  });

  it('responde 404 para id malformado, sem consultar o banco', async () => {
    const deps = depsOk();
    const res = await run(del('sess-2'), { id: 'sess-2' }, deps);
    expect(res.status).toBe(404);
    expect(deps.revoke).not.toHaveBeenCalled();
  });

  it('recusa origem não permitida no DELETE por cookie', async () => {
    const deps = depsOk();
    const res = await run(del(OUTRA, 'https://evil.example'), { id: OUTRA }, deps);
    expect(res.status).toBe(403);
    expect(deps.revoke).not.toHaveBeenCalled();
  });

  it('recusa DELETE sem id', async () => {
    const res = await run(del(''), {}, depsOk());
    expect(res.status).toBe(400);
  });

  it('aplica o rate limit geral', async () => {
    const deps = depsOk();
    await run(get(), {}, deps);
    expect(deps.enforceRouteRateLimit).toHaveBeenCalledWith(expect.any(Request), 'user-1');
  });
});

