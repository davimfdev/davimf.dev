export type AccessLevel = 'support' | 'owner' | 'delegate';

export type GuildAccess = {
  ok: true;
  userId: string;
  guildId: string;
  accessLevel: AccessLevel;
  accessVia: 'support' | 'owner' | 'user' | 'role';
  canManageAccess: boolean;
  roleDelegationAvailable: boolean;
};

export type AccessDenied = {
  ok: false;
  status: 400 | 401 | 403 | 502;
  code: string;
  roleDelegationAvailable?: boolean;
};

export type GuildAccessResult = GuildAccess | AccessDenied;
