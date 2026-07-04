import { useOutletContext } from 'react-router-dom';
import type { GuildConfigResponse } from './api';
import type { RoleOption } from './types';

export type DashboardAccessMap = { users: string[]; roles: string[] };

export type DashboardContext = {
  guildId: string;
  data: GuildConfigResponse;
  configMap: (key: string) => Record<string, unknown>;
  channels: { id: string; name: string }[];
  roles: RoleOption[];
  accessMap: DashboardAccessMap;
  setAccessMap: (next: DashboardAccessMap) => void;
  saveMap: (column: 'channels' | 'roles' | 'toggles' | 'settings', values: Record<string, unknown>) => Promise<void>;
  mutateCollection: (collection: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>, resourceId?: string) => Promise<void>;
};

export function useDashboardContext(): DashboardContext {
  return useOutletContext<DashboardContext>();
}
