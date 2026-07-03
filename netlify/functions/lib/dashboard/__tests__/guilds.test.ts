import { describe, expect, it, vi } from 'vitest';
import { getVisibleGuilds } from '../guilds';

describe('dashboard guild listing', () => {
  it('lists every present bot guild for support without Discord membership lookup', async () => {
    const deps = {
      supportIds: new Set(['support']),
      listBotGuilds: vi.fn().mockResolvedValue([{ guildId: 'g1', name: 'One', botPresent: true }]),
      listDiscordGuilds: vi.fn().mockRejectedValue(new Error('must not run')),
      listDirectDelegations: vi.fn().mockResolvedValue([]),
    };
    const result = await getVisibleGuilds({ userId: 'support', accessToken: 't', scopes: [], expiresAt: new Date() }, deps);
    expect(result).toEqual([expect.objectContaining({ id: 'g1', accessLevel: 'support' })]);
    expect(deps.listDiscordGuilds).not.toHaveBeenCalled();
  });

  it('crosses Discord guilds with bot guilds for regular users', async () => {
    const result = await getVisibleGuilds({ userId: 'u1', accessToken: 't', scopes: ['guilds'], expiresAt: new Date() }, {
      supportIds: new Set(),
      listBotGuilds: vi.fn().mockResolvedValue([{ guildId: 'g1', name: 'One', botPresent: true }, { guildId: 'g2', name: 'Two', botPresent: true }]),
      listDiscordGuilds: vi.fn().mockResolvedValue([{ id: 'g1', name: 'One', owner: true }]),
      listDirectDelegations: vi.fn().mockResolvedValue(['g2']),
    });
    expect(result).toEqual([
      expect.objectContaining({ id: 'g1', accessLevel: 'owner' }),
      expect.objectContaining({ id: 'g2', accessLevel: 'delegate' }),
    ]);
  });
});
