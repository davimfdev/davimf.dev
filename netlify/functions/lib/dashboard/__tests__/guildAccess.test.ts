import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireGuildAccess, type GuildAccessDeps } from '../guildAccess';

const event = { headers: { cookie: 'session=x' } };

function deps(overrides: Partial<GuildAccessDeps> = {}): GuildAccessDeps {
  return {
    requireSession: vi.fn().mockResolvedValue({
      ok: true,
      session: { userId: 'u1', accessToken: 'token', scopes: ['guilds', 'guilds.members.read'] },
    }),
    supportIds: new Set(),
    getBotGuild: vi.fn().mockResolvedValue({ guildId: 'g1', botPresent: true }),
    getDiscordGuilds: vi.fn().mockResolvedValue([{ id: 'g1', owner: false }]),
    getDashboardAccess: vi.fn().mockResolvedValue({ users: [], roles: [] }),
    getMemberRoles: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('requireGuildAccess', () => {
  beforeEach(() => {
    process.env.BOT_SUPPORT_USER_IDS = '344214477069221888,956985471332937778';
  });

  it('grants support without requiring Discord guild membership', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      requireSession: vi.fn().mockResolvedValue({ ok: true, session: { userId: '344214477069221888', accessToken: 't', scopes: [] } }),
      supportIds: new Set(['344214477069221888']),
      getDiscordGuilds: vi.fn().mockRejectedValue(new Error('must not be called')),
    }));
    expect(result).toMatchObject({ ok: true, accessLevel: 'support', canManageAccess: true });
  });

  it('grants the Discord guild owner', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      getDiscordGuilds: vi.fn().mockResolvedValue([{ id: 'g1', owner: true }]),
    }));
    expect(result).toMatchObject({ ok: true, accessLevel: 'owner', canManageAccess: true });
  });

  it('grants a directly delegated user', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      getDashboardAccess: vi.fn().mockResolvedValue({ users: ['u1'], roles: [] }),
    }));
    expect(result).toMatchObject({ ok: true, accessLevel: 'delegate', accessVia: 'user', canManageAccess: false });
  });

  it('grants a delegated role when the scope is available', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      getDashboardAccess: vi.fn().mockResolvedValue({ users: [], roles: ['r1'] }),
      getMemberRoles: vi.fn().mockResolvedValue(['r1']),
    }));
    expect(result).toMatchObject({ ok: true, accessLevel: 'delegate', accessVia: 'role' });
  });

  it('denies role delegation without guilds.members.read', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      requireSession: vi.fn().mockResolvedValue({ ok: true, session: { userId: 'u1', accessToken: 't', scopes: ['guilds'] } }),
      getDashboardAccess: vi.fn().mockResolvedValue({ users: [], roles: ['r1'] }),
    }));
    expect(result).toMatchObject({ ok: false, status: 403, roleDelegationAvailable: false });
  });

  it('denies every access level when the bot is absent', async () => {
    const result = await requireGuildAccess(event, 'g1', deps({
      requireSession: vi.fn().mockResolvedValue({ ok: true, session: { userId: '344214477069221888', accessToken: 't', scopes: [] } }),
      supportIds: new Set(['344214477069221888']),
      getBotGuild: vi.fn().mockResolvedValue(null),
    }));
    expect(result).toMatchObject({ ok: false, status: 403, code: 'BOT_NOT_PRESENT' });
  });
});
