import type { DashboardGuild } from './types';

export class DashboardApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string; field?: string } };
  if (!response.ok) throw new DashboardApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'Falha na solicitação.', payload.error?.field);
  return payload as T;
}

export type DashboardSession = { userId: string; scopes: string[] };
export type Health = { status?: string; issues?: unknown[]; channelCount?: number; roleCount?: number; [key: string]: unknown };
export type GuildConfigResponse = {
  guild: { id: string; name: string; accessLevel: 'support' | 'owner' | 'delegate'; canManageAccess: boolean };
  config: Record<string, unknown>;
  channels: Array<Record<string, unknown>>;
  roles: Array<Record<string, unknown>>;
  health: Health;
  collections: Record<string, unknown[]>;
};

export const dashboardApi = {
  session: () => request<DashboardSession>('/api/dashboard-session'),
  guilds: () => request<DashboardGuild[]>('/api/bot-guilds'),
  config: (guildId: string, signal?: AbortSignal) => request<GuildConfigResponse>(`/api/bot-config-get?guildId=${encodeURIComponent(guildId)}`, { signal }),
  patch: (guildId: string, column: string, set: Record<string, unknown>, remove: string[] = []) => request<{ ok: true }>('/api/bot-config-patch', {
    method: 'PATCH', body: JSON.stringify({ guildId, column, set, remove }),
  }),
  access: (guildId: string, signal?: AbortSignal) => request<Record<string, unknown>>(`/api/bot-config-access?guildId=${encodeURIComponent(guildId)}`, { signal }),
  updateAccess: (guildId: string, users: string[], roles: string[]) => request<{ ok: true }>('/api/bot-config-access', {
    method: 'PATCH', body: JSON.stringify({ guildId, users, roles }),
  }),
  collection: (guildId: string, collection: string, method: 'POST' | 'PATCH' | 'DELETE', data: Record<string, unknown> = {}, resourceId?: string) =>
    request<Record<string, unknown>>('/api/bot-config-collection', {
      method, body: JSON.stringify({ guildId, collection, resourceId, data }),
    }),
};
