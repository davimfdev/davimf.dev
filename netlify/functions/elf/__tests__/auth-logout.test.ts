import { describe, it, expect, vi } from 'vitest';
import { withElf } from '../lib/http';
import { handleAuthLogout } from '../auth-logout';

const req = (origin = 'https://elf.davimf.dev') =>
  new Request('https://elf.davimf.dev/api/elf/auth/logout', {
    method: 'POST',
    headers: { origin },
  });

const sessao = (isCookieAuth: boolean) => ({
  ok: true as const,
  isCookieAuth,
  session: { id: 'sess-1', userId: 'user-1', deviceId: 'dev-1', platform: 'web' as const },
});

describe('handleAuthLogout', () => {
  it('responde 401 sem sessão', async () => {
    const revoke = vi.fn();
    const res = await handleAuthLogout(req(), {
      requireSession: (async () => ({ ok: false, status: 401, code: 'UNAUTHENTICATED' })) as never,
      revoke: revoke as never,
    });
    expect(res.status).toBe(401);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('revoga a sessão no servidor', async () => {
    const revoke = vi.fn(async () => true);
    const res = await handleAuthLogout(req(), {
      requireSession: (async () => sessao(true)) as never,
      revoke: revoke as never,
    });
    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenCalledWith('sess-1', 'user-1');
  });

  it('expira o cookie', async () => {
    const res = await handleAuthLogout(req(), {
      requireSession: (async () => sessao(true)) as never,
      revoke: (async () => true) as never,
    });
    expect(res.headers.get('Set-Cookie')).toContain('elf_session=;');
    expect(res.headers.get('Set-Cookie')).toContain('Expires=');
  });

  it('recusa com 403 origem não permitida em requisição por cookie', async () => {
    const revoke = vi.fn(async () => true);
    const handler = withElf((request) =>
      handleAuthLogout(request, {
        requireSession: (async () => sessao(true)) as never,
        revoke: revoke as never,
      }),
    );
    const res = await handler(req('https://evil.example'));
    expect(res.status).toBe(403);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('aceita qualquer origem quando a sessão vem por Bearer', async () => {
    const res = await handleAuthLogout(req('https://evil.example'), {
      requireSession: (async () => sessao(false)) as never,
      revoke: (async () => true) as never,
    });
    expect(res.status).toBe(200);
  });
});
