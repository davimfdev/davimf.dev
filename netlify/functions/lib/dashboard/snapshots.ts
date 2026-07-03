export type SnapshotState = 'fresh' | 'stale' | 'blocked';

export type ChannelSnapshot = {
  channelId: string;
  type: string;
  botCanView: boolean;
  botCanSend: boolean;
};

export type RoleSnapshot = { roleId: string; botCanAssign: boolean };
export type ResourceValidation = { ok: true } | { ok: false; code: string };

const TEXT_TYPES = new Set(['TEXT', 'NEWS', 'FORUM', 'GUILD_TEXT', 'GUILD_ANNOUNCEMENT']);

export function classifySnapshotAge(updatedAt: Date, now = Date.now()): SnapshotState {
  const age = now - updatedAt.getTime();
  if (!Number.isFinite(age) || age > 15 * 60_000) return 'blocked';
  return age > 10 * 60_000 ? 'stale' : 'fresh';
}

export function validateChannel(channel: ChannelSnapshot | undefined, needsSend: boolean): ResourceValidation {
  if (!channel) return { ok: false, code: 'CHANNEL_NOT_FOUND' };
  if (!TEXT_TYPES.has(channel.type.toUpperCase())) return { ok: false, code: 'CHANNEL_TYPE_INVALID' };
  if (!channel.botCanView) return { ok: false, code: 'CHANNEL_NOT_VISIBLE' };
  if (needsSend && !channel.botCanSend) return { ok: false, code: 'CHANNEL_CANNOT_SEND' };
  return { ok: true };
}

export function validateRole(role: RoleSnapshot | undefined, needsAssign: boolean): ResourceValidation {
  if (!role) return { ok: false, code: 'ROLE_NOT_FOUND' };
  if (needsAssign && !role.botCanAssign) return { ok: false, code: 'ROLE_NOT_ASSIGNABLE' };
  return { ok: true };
}

export type GuildHealthInput = {
  botPresent: boolean;
  lastSeenAt: Date;
  lastConfigReadAt: Date | null;
  channels: ChannelSnapshot[];
  roles: RoleSnapshot[];
  configuredSendingChannelIds: string[];
};

export type GuildHealth = {
  botPresent: boolean;
  lastSeenAt: string;
  lastConfigReadAt: string | null;
  snapshotState: SnapshotState;
  channelCount: number;
  roleCount: number;
  missingCriticalPermissions: string[];
  inaccessibleConfiguredChannels: string[];
};

export function buildGuildHealth(input: GuildHealthInput, now = Date.now()): GuildHealth {
  const channelById = new Map(input.channels.map((channel) => [channel.channelId, channel]));
  const inaccessibleConfiguredChannels = input.configuredSendingChannelIds.filter((id) => {
    const channel = channelById.get(id);
    return !channel?.botCanView || !channel.botCanSend;
  });
  const missing = new Set<string>();
  if (input.channels.some((channel) => !channel.botCanView)) missing.add('channel:view');
  if (inaccessibleConfiguredChannels.length > 0) missing.add('channel:send');
  if (input.roles.some((role) => !role.botCanAssign)) missing.add('role:assign');
  return {
    botPresent: input.botPresent,
    lastSeenAt: input.lastSeenAt.toISOString(),
    lastConfigReadAt: input.lastConfigReadAt?.toISOString() ?? null,
    snapshotState: classifySnapshotAge(input.lastSeenAt, now),
    channelCount: input.channels.length,
    roleCount: input.roles.length,
    missingCriticalPermissions: [...missing],
    inaccessibleConfiguredChannels,
  };
}
