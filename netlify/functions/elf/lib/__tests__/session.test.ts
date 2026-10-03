import { describe, it, expect, vi } from 'vitest';
import { signToken, randomToken } from '../crypto';
import { requireElfSession, createElfSession, revokeSessionById, ELF_SESSION_COOKIE } from '../session';

const futuro = new Date(Date.now() + 60_000);
const passado = new Date(Date.now() - 60_000);
const agora = new Date();

const linha = (over: Record<string, unknown> = {}) => ({
  id: 'sess-1',
  user_id: 'user-1',
  device_id: 'dev-1',
  platform: 'web',
  expires_at: futuro,
  created_at: agora,
  last_used_at: agora,
  session_revoked_at: null,
  device_revoked_at: null,
  ...over,
});

const sqlComLinha = (row: Record<string, unknown> | null) =>
  vi.fn(async () => (row ? [row] : [])) as never;

const comBearer = (token: string) =>
  new Request('https://elf.davimf.dev/api/elf/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

const comCookie = (token: string) =>
  new Request('https://elf.davimf.dev/api/elf/auth/me', {
    headers: { cookie: `${ELF_SESSION_COOKIE}=${token}` },
  });

describe('requireElfSession', () => {
  it('recusa requisição sem credencial', async () => {
    const res = await requireElfSession(new Request('https://elf.davimf.dev/api/elf/auth/me'), {
      sql: sqlComLinha(linha()),
    });
    expect(res).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('recusa token com HMAC adulterado sem consultar o banco', async () => {
    const query = vi.fn(async () => [linha()]);
    const res = await requireElfSession(comBearer(`${signToken(randomToken())}x`), {
      sql: query as never,
    });
    expect(res).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
    expect(query).not.toHaveBeenCalled();
  });

  it('aceita sessão válida por Bearer', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha()),
    });
    expect(res).toEqual({
      ok: true,
      isCookieAuth: false,
      session: { id: 'sess-1', userId: 'user-1', deviceId: 'dev-1', platform: 'web' },
    });
  });

  it('aceita sessão válida por cookie e marca isCookieAuth', async () => {
    const res = await requireElfSession(comCookie(signToken(randomToken())), {
      sql: sqlComLinha(linha()),
    });
    expect(res).toMatchObject({ ok: true, isCookieAuth: true });
  });

  it('aceita timestamps em texto além de Date', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha({ expires_at: futuro.toISOString(), created_at: agora.toISOString() })),
    });
    expect(res).toMatchObject({ ok: true });
  });

  it('recusa sessão inexistente', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(null),
    });
    expect(res).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('recusa sessão revogada', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha({ session_revoked_at: agora })),
    });
    expect(res).toMatchObject({ ok: false, code: 'SESSION_REVOKED' });
  });

  it('recusa sessão expirada', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha({ expires_at: passado })),
    });
    expect(res).toMatchObject({ ok: false, code: 'SESSION_EXPIRED' });
  });

  it('recusa sessão além do teto absoluto de 90 dias', async () => {
    const antiga = new Date(Date.now() - 91 * 24 * 3600_000);
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha({ created_at: antiga })),
    });
    expect(res).toMatchObject({ ok: false, code: 'SESSION_EXPIRED' });
  });

  it('recusa sessão de dispositivo revogado', async () => {
    const res = await requireElfSession(comBearer(signToken(randomToken())), {
      sql: sqlComLinha(linha({ device_revoked_at: agora })),
    });
    expect(res).toMatchObject({ ok: false, code: 'DEVICE_REVOKED' });
  });

  it('não reescreve last_used_at dentro da janela de 15 minutos', async () => {
    const query = vi.fn(async () => [linha()]);
    await requireElfSession(comBearer(signToken(randomToken())), { sql: query as never });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('renova last_used_at fora da janela', async () => {
    const velho = new Date(Date.now() - 20 * 60_000);
    const query = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => [linha({ last_used_at: velho })]);
    await requireElfSession(comBearer(signToken(randomToken())), { sql: query as never });
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain('UPDATE elf_sessions');
  });

  it('prefere Bearer quando os dois transportes vêm juntos', async () => {
    const req = new Request('https://elf.davimf.dev/api/elf/auth/me', {
      headers: {
        Authorization: `Bearer ${signToken(randomToken())}`,
        cookie: `${ELF_SESSION_COOKIE}=${signToken(randomToken())}`,
      },
    });
    const res = await requireElfSession(req, { sql: sqlComLinha(linha()) });
    expect(res).toMatchObject({ ok: true, isCookieAuth: false });
  });
});

describe('createElfSession', () => {
  it('grava o hash e devolve o valor assinado, nunca o id em claro', async () => {
    const gravado: unknown[][] = [];
    const query = vi.fn(async (_s: unknown, ...values: unknown[]) => {
      gravado.push(values);
      return [];
    });
    const assinado = await createElfSession(
      { userId: 'user-1', deviceId: 'dev-1', platform: 'web' },
      { sql: query as never },
    );
    const idEmClaro = assinado.split('.')[0] ?? '';
    expect(idEmClaro.length).toBeGreaterThan(20);
    expect(JSON.stringify(gravado)).not.toContain(idEmClaro);
    expect(gravado[0]).toContain('dev-1');
  });
});

describe('revokeSessionById', () => {
  it('filtra pelo usuário da sessão', async () => {
    const query = vi.fn(async () => [{ id: 'sess-1' }]);
    expect(await revokeSessionById('sess-1', 'user-1', { sql: query as never })).toBe(true);
    expect(query.mock.calls[0]?.slice(1)).toEqual(['sess-1', 'user-1']);
  });

  it('devolve false quando nada foi revogado', async () => {
    const query = vi.fn(async () => []);
    expect(await revokeSessionById('sess-x', 'user-1', { sql: query as never })).toBe(false);
  });
});
