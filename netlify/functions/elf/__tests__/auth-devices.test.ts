import { describe, it, expect, vi } from 'vitest';
import { withElf } from '../lib/http';
import { handleDevices } from '../auth-devices';

const ATUAL = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';

const sessaoOk = {
  ok: true as const,
  isCookieAuth: true,
  session: { id: 'sess-1', userId: 'user-1', deviceId: ATUAL, platform: 'web' as const },
};

const get = () => new Request('https://elf.davimf.dev/api/elf/auth/devices');
const del = (id: string, origin = 'https://elf.davimf.dev') =>
  new Request(`https://elf.davimf.dev/api/elf/auth/devices/${id}`, {
    method: 'DELETE',
    headers: { origin },
  });

const linhas = () => [
  {
    id: ATUAL,
    name: 'Chrome no Windows',
    platform: 'web',
    created_at: new Date('2026-10-01T10:00:00Z'),
    last_seen_at: new Date('2026-10-04T10:00:00Z'),
    active_sessions: 1,
  },
  {
    id: OUTRO,
    name: 'Notebook',
    platform: 'desktop',
    created_at: new Date('2026-10-02T10:00:00Z'),
    last_seen_at: new Date('2026-10-03T10:00:00Z'),
    active_sessions: 2,
  },
];

function depsOk(deviceRows: unknown[] = [{ id: OUTRO }]) {
  const executados: Array<{ text: string; values: unknown[] }> = [];
  const tx = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    executados.push({ text, values });
    return text.includes('UPDATE devices') ? deviceRows : [];
  });
  return {
    executados,
    deps: {
      requireSession: vi.fn(async () => sessaoOk),
      enforceRouteRateLimit: vi.fn(async () => {}),
      sql: vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>(async () => linhas()),
      withTransaction: vi.fn(async (fn: (t: never) => Promise<unknown>) => fn(tx as never)),
    },
  };
}

const run = (request: Request, params: { id?: string }, deps: Record<string, unknown>) =>
  withElf((r, ctx) => handleDevices(r, params, ctx, deps as never))(request);

describe('handleDevices', () => {
  it('responde 401 sem sessão', async () => {
    const { deps } = depsOk();
    deps.requireSession.mockResolvedValueOnce({ ok: false, status: 401, code: 'UNAUTHENTICATED' } as never);
    expect((await run(get(), {}, deps)).status).toBe(401);
  });

  it('lista dispositivos com contagem de sessões ativas e marca o atual', async () => {
    const { deps } = depsOk();
    const res = await run(get(), {}, deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; activeSessionCount: number; isCurrent: boolean; lastSeenAt: string }>;
    };
    expect(body.data.map((d) => [d.id, d.activeSessionCount, d.isCurrent])).toEqual([
      [ATUAL, 1, true],
      [OUTRO, 2, false],
    ]);
    expect(body.data[0]?.lastSeenAt).toBe('2026-10-04T10:00:00.000Z');
    expect(deps.sql.mock.calls[0]?.slice(1)).toEqual(['user-1']);
  });

  it('revoga o dispositivo e todas as sessões dele, filtrando pelo usuário', async () => {
    const { deps, executados } = depsOk();
    const res = await run(del(OUTRO), { id: OUTRO }, deps);
    expect(res.status).toBe(200);
    const sessoes = executados.find((e) => e.text.includes('UPDATE elf_sessions'));
    expect(sessoes?.values).toEqual([OUTRO, 'user-1']);
    expect(executados.some((e) => e.text.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('responde 404 e não toca em sessões quando o dispositivo não é do usuário', async () => {
    const { deps, executados } = depsOk([]);
    const res = await run(del(OUTRO), { id: OUTRO }, deps);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('DEVICE_NOT_FOUND');
    expect(executados.some((e) => e.text.includes('UPDATE elf_sessions'))).toBe(false);
  });

  it('responde 404 para id malformado sem abrir transação', async () => {
    const { deps } = depsOk();
    const res = await run(del('dev-2'), { id: 'dev-2' }, deps);
    expect(res.status).toBe(404);
    expect(deps.withTransaction).not.toHaveBeenCalled();
  });

  it('recusa origem não permitida sem abrir transação', async () => {
    const { deps } = depsOk();
    const res = await run(del(OUTRO, 'https://evil.example'), { id: OUTRO }, deps);
    expect(res.status).toBe(403);
    expect(deps.withTransaction).not.toHaveBeenCalled();
  });

  it('recusa DELETE sem id', async () => {
    const { deps } = depsOk();
    expect((await run(del(''), {}, deps)).status).toBe(400);
  });
});
