import { describe, it, expect, vi } from 'vitest';
import { requireGuildAccess } from '../requireGuildAccess';

const ev = (auth?: string) => ({ headers: auth ? { authorization: `Bearer ${auth}` } : {} } as any);

// fetch fake: /users/@me -> {id}, /users/@me/guilds -> lista
function fakeFetch(userId: string | null, guilds: any[]) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) {
      return { ok: !!userId, json: async () => ({ id: userId }) } as any;
    }
    if (url.endsWith('/users/@me/guilds')) {
      return { ok: true, json: async () => guilds } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  });
}
const sqlPresent = (present: boolean) => (async () => (present ? [{ '?column?': 1 }] : [])) as any;

describe('requireGuildAccess', () => {
  it('401 sem token', async () => {
    const r = await requireGuildAccess(ev(), 'g1', { fetchImpl: fakeFetch(null, []), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
  it('403 se não é dono', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: false }]), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('403 se bot ausente', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: true }]), sql: sqlPresent(false) });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('ok quando dono + bot presente', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: true }]), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: true, userId: 'u1' });
  });
});
