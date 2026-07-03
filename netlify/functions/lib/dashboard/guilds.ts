import type { DashboardSession } from './session';

export type BotGuildSummary = { guildId: string; name: string; botPresent: boolean; lastSeenAt?: string };
type DiscordGuildSummary = { id: string; name: string; owner?: boolean; icon?: string };
export type VisibleGuild = {
  id: string;
  name: string;
  icon?: string;
  botPresent: boolean;
  lastSeenAt?: string;
  accessLevel: 'support' | 'owner' | 'delegate';
};

export type GuildListDeps = {
  supportIds: ReadonlySet<string>;
  listBotGuilds: () => Promise<BotGuildSummary[]>;
  listDiscordGuilds: (accessToken: string) => Promise<DiscordGuildSummary[]>;
  listDirectDelegations: (userId: string) => Promise<string[]>;
  listRoleDelegations?: (session: DashboardSession, botGuilds: BotGuildSummary[]) => Promise<string[]>;
};

export async function getVisibleGuilds(session: DashboardSession, deps: GuildListDeps): Promise<VisibleGuild[]> {
  const botGuilds = (await deps.listBotGuilds()).filter((guild) => guild.botPresent);
  if (deps.supportIds.has(session.userId)) {
    return botGuilds.map((guild) => ({
      id: guild.guildId, name: guild.name, botPresent: true, lastSeenAt: guild.lastSeenAt, accessLevel: 'support',
    }));
  }
  const [discordGuilds, directIds, roleIds] = await Promise.all([
    deps.listDiscordGuilds(session.accessToken),
    deps.listDirectDelegations(session.userId),
    deps.listRoleDelegations?.(session, botGuilds) ?? Promise.resolve([]),
  ]);
  const discordById = new Map(discordGuilds.map((guild) => [guild.id, guild]));
  const direct = new Set(directIds);
  const role = new Set(roleIds);
  return botGuilds.flatMap((guild) => {
    const discord = discordById.get(guild.guildId);
    const accessLevel = discord?.owner ? 'owner' : direct.has(guild.guildId) || role.has(guild.guildId) ? 'delegate' : null;
    return accessLevel ? [{
      id: guild.guildId,
      name: discord?.name ?? guild.name,
      icon: discord?.icon,
      botPresent: true,
      lastSeenAt: guild.lastSeenAt,
      accessLevel,
    }] : [];
  });
}
