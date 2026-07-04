export type AccessLevel = 'support' | 'owner' | 'delegate';

export type DashboardGuild = {
  id: string;
  name: string;
  icon?: string;
  botPresent: boolean;
  lastSeenAt?: string;
  accessLevel: AccessLevel;
};

export type RoleOption = { id: string; name: string; color?: number | null };
