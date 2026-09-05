import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { dashboardApi, DashboardApiError, type GuildConfigResponse } from '../features/bot-dashboard/api';
import { DashboardShell } from '../features/bot-dashboard/DashboardShell';
import { mergeConfigColumn, collectionKeyFor, applyCollectionMutation } from '../features/bot-dashboard/optimistic';
import type { DashboardAccessMap, DashboardContext } from '../features/bot-dashboard/dashboardContext';
import type { RoleOption } from '../features/bot-dashboard/types';
import '../features/bot-dashboard/editors.css';

const hashToRoute: Record<string, string> = {
  overview: 'overview', channels: 'channels', roles: 'roles',
  moderation: 'moderation', security: 'security', modules: 'modules',
};

export default function BotConfig() {
  const { guildId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<GuildConfigResponse | null>(null);
  const [error, setError] = useState<DashboardApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessMap, setAccessMap] = useState<DashboardAccessMap>({ users: [], roles: [] });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const next = await dashboardApi.config(guildId, signal);
      if (signal?.aborted) return;
      setData(next); setError(null);
      if (next.guild.canManageAccess) {
        const access = await dashboardApi.access(guildId, signal);
        if (signal?.aborted) return;
        setAccessMap({ users: Array.isArray(access.users) ? access.users.map(String) : [], roles: Array.isArray(access.roles) ? access.roles.map(String) : [] });
      }
    }
    catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      const apiError = cause instanceof DashboardApiError ? cause : new DashboardApiError(500, 'LOAD_FAILED', 'Falha ao carregar.');
      if (apiError.status === 401) { window.location.href = `/api/dashboard-login?returnTo=${encodeURIComponent(`/dashboard/${guildId}`)}`; return; }
      if (apiError.status === 403) { navigate('/dashboard', { replace: true }); return; }
      setError(apiError);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [guildId, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // Reload only when the guild changes - not when `load`'s identity churns.
    // react-router's `navigate` gets a new identity on each navigation, which
    // would otherwise refetch the config on every section change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // Soft-migrate old hash deep-links (/dashboard/:id#security) once on mount.
  useEffect(() => {
    const target = hashToRoute[location.hash.replace(/^#/, '')];
    if (target) navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMap = useCallback(async (column: 'channels' | 'roles' | 'toggles' | 'settings', values: Record<string, unknown>) => {
    await dashboardApi.patch(guildId, column, values);
    setData((prev) => (prev ? mergeConfigColumn(prev, column, values) : prev));
  }, [guildId]);

  const mutateCollection = useCallback(async (collection: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>, resourceId?: string) => {
    const res = await dashboardApi.collection(guildId, collection, method, payload, resourceId) as { item?: Record<string, unknown> };
    const key = collectionKeyFor(collection);
    if (key) setData((prev) => (prev ? { ...prev, collections: applyCollectionMutation(prev.collections, key, method, res.item, resourceId) } : prev));
  }, [guildId]);

  const ctx = useMemo<DashboardContext | null>(() => {
    if (!data) return null;
    const roles: RoleOption[] = data.roles.map((item) => ({
      id: String(item.role_id ?? item.roleId ?? ''),
      name: String(item.name ?? item.role_name ?? 'Cargo'),
      color: typeof item.color === 'number' ? item.color : null,
    })).filter((item) => item.id);
    const channels = data.channels.map((item) => ({ id: String(item.channel_id ?? item.channelId ?? ''), name: String(item.name ?? item.channel_name ?? 'Canal') })).filter((item) => item.id);
    const configMap = (key: string) => (data.config[key] && typeof data.config[key] === 'object' ? data.config[key] as Record<string, unknown> : {});
    return { guildId, data, configMap, channels, roles, accessMap, setAccessMap, saveMap, mutateCollection };
  }, [guildId, data, accessMap, saveMap, mutateCollection]);

  if (loading) return <div className="bd-full-loading"><span /><p>Preparando configuração do servidor…</p></div>;
  if (error || !data || !ctx) return <div className="bd-full-error"><AlertTriangle /><h1>Configuração indisponível</h1><p>{error?.message ?? 'O servidor não retornou dados válidos.'}</p><button className="bd-button bd-button--quiet" onClick={() => void load()}><RefreshCw /> Tentar novamente</button></div>;

  return (
    <DashboardShell guildName={data.guild.name} accessLevel={data.guild.accessLevel}>
      <Outlet context={ctx} />
    </DashboardShell>
  );
}
