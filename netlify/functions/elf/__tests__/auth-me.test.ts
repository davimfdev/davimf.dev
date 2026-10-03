import { describe, it, expect, vi } from 'vitest';
import { handleAuthMe } from '../auth-me';

const req = (method = 'GET') => new Request('https://elf.davimf.dev/api/elf/auth/me', { method });

const sessaoOk = {
  ok: true as const,
  isCookieAuth: true,
  session: { id: 'sess-1', userId: 'user-1', deviceId: 'dev-1', platform: 'web' as const },
};

const linhaUsuario = () => [
  {
    id: 'user-1',
    display_name: 'Davi',
    avatar_url: null,
    device_name: 'Chrome no Windows',
    expires_at: new Date('2026-11-01T00:00:00Z'),
  },
];

const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('handleAuthMe', () => {
  it('responde 401 sem sessão', async () => {
    const res = await handleAuthMe(req(), {
      requireSession: (async () => ({ ok: false, status: 401, code: 'UNAUTHENTICATED' })) as never,
    });
    expect(res.status).toBe(401);
    expect(await codeOf(res)).toBe('UNAUTHENTICATED');
  });

  it('propaga o código específico da falha', async () => {
    const res = await handleAuthMe(req(), {
      requireSession: (async () => ({ ok: false, status: 401, code: 'DEVICE_REVOKED' })) as never,
    });
    expect(await codeOf(res)).toBe('DEVICE_REVOKED');
  });

  it('devolve usuário e sessão em camelCase', async () => {
    const res = await handleAuthMe(req(), {
      requireSession: (async () => sessaoOk) as never,
      sql: (async () => linhaUsuario()) as never,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: 'user-1', displayName: 'Davi', avatarUrl: null },
      session: {
        platform: 'web',
        deviceName: 'Chrome no Windows',
        expiresAt: '2026-11-01T00:00:00.000Z',
      },
    });
  });

  it('consulta filtrando pelo usuário da sessão', async () => {
    const query = vi.fn(async () => linhaUsuario());
    await handleAuthMe(req(), { requireSession: (async () => sessaoOk) as never, sql: query as never });
    expect(query.mock.calls[0]?.slice(1)).toEqual(['sess-1', 'user-1']);
  });

  it('recusa método diferente de GET', async () => {
    const res = await handleAuthMe(req('POST'), { requireSession: (async () => sessaoOk) as never });
    expect(res.status).toBe(400);
  });
});
