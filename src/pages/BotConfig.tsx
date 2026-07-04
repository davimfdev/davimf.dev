import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dashboardApi, DashboardApiError, type GuildConfigResponse } from '../features/bot-dashboard/api';
import { DashboardShell } from '../features/bot-dashboard/DashboardShell';
import { Overview } from '../features/bot-dashboard/Overview';
import { ConfigMapEditor, type ConfigField } from '../features/bot-dashboard/ConfigMapEditor';
import { AccessEditor } from '../features/bot-dashboard/AccessEditor';
import { CollectionEditor } from '../features/bot-dashboard/CollectionEditor';
import type { AccessLevel } from '../features/bot-dashboard/types';
import '../features/bot-dashboard/editors.css';

const channelFields: ConfigField[] = [
  ['log-comandos','Log de comandos'],['log-mensagens','Log de mensagens'],['log-entradas','Entradas'],['log-saidas','Saídas'],['log-moderacao','Moderação'],['log-tickets','Tickets'],['welcome:channel','Boas-vindas'],['level-notify','Avisos de nível'],
].map(([key,label]) => ({ key, label, kind: 'channel' }));
const roleFields: ConfigField[] = [
  ['moderador','Moderador'],['staff','Staff'],['mutado','Mutado'],['nao-verificado','Não verificado'],['welcome:autorole','Cargo de entrada'],
].map(([key,label]) => ({ key, label, kind: 'role' }));
const toggleFields: ConfigField[] = [
  ['mod:dm-on-action','Avisar ações por DM'],['sec:automod','Automod'],['sec:verify','Verificação'],['sec:antiraid','Antiraid'],['sec:antinuke','Antinuke'],['welcome:enabled','Boas-vindas'],['level:enabled','Níveis'],['eco:enabled','Economia'],['event:enabled','Eventos'],
].map(([key,label]) => ({ key, label, kind: 'boolean' }));
const settingFields: ConfigField[] = [
  { key: 'mod:warn-ttl-days', label: 'Validade de avisos (dias)', kind: 'number' },
  { key: 'sec:automod-mention-limit', label: 'Limite de menções', kind: 'number' },
  { key: 'welcome:message', label: 'Mensagem de boas-vindas', kind: 'string' },
  { key: 'level:notify', label: 'Destino dos avisos de nível', kind: 'string', options: [{value:'atual',label:'Canal atual'},{value:'canal',label:'Canal configurado'},{value:'dm',label:'Mensagem direta'},{value:'off',label:'Desativado'}] },
  { key: 'eco:currency-name', label: 'Nome da moeda', kind: 'string' },
  { key: 'eco:daily', label: 'Recompensa diária', kind: 'number' },
] as ConfigField[];

export default function BotConfig() {
  const { guildId = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<GuildConfigResponse | null>(null);
  const [error, setError] = useState<DashboardApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessMap, setAccessMap] = useState<{ users: string[]; roles: string[] }>({ users: [], roles: [] });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const next = await dashboardApi.config(guildId); setData(next);
      if (next.guild.canManageAccess) {
        const access = await dashboardApi.access(guildId);
        setAccessMap({ users: Array.isArray(access.users) ? access.users.map(String) : [], roles: Array.isArray(access.roles) ? access.roles.map(String) : [] });
      }
    }
    catch (cause) {
      const apiError = cause instanceof DashboardApiError ? cause : new DashboardApiError(500, 'LOAD_FAILED', 'Falha ao carregar.');
      if (apiError.status === 401) { window.location.href = `/api/dashboard-login?returnTo=${encodeURIComponent(`/dashboard/${guildId}`)}`; return; }
      if (apiError.status === 403) { navigate('/dashboard', { replace: true }); return; }
      setError(apiError);
    } finally { setLoading(false); }
  }, [guildId, navigate]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="bd-full-loading"><span /><p>Preparando configuração do servidor…</p></div>;
  if (error || !data) return <div className="bd-full-error"><AlertTriangle /><h1>Configuração indisponível</h1><p>{error?.message ?? 'O servidor não retornou dados válidos.'}</p><button className="bd-button bd-button--quiet" onClick={() => void load()}><RefreshCw /> Tentar novamente</button></div>;

  const configMap = (key: string) => data.config[key] && typeof data.config[key] === 'object' ? data.config[key] as Record<string, unknown> : {};
  const channels = data.channels.map((item) => ({ id: String(item.channel_id ?? item.channelId ?? ''), name: String(item.name ?? item.channel_name ?? 'Canal') })).filter((item) => item.id);
  const roles = data.roles.map((item) => ({ id: String(item.role_id ?? item.roleId ?? ''), name: String(item.name ?? item.role_name ?? 'Cargo') })).filter((item) => item.id);
  const saveMap = async (column: 'channels'|'roles'|'toggles'|'settings', values: Record<string, unknown>) => { await dashboardApi.patch(guildId, column, values); await load(); };
  const mutateCollection = async (collection: string, method: 'POST'|'PATCH'|'DELETE', payload: Record<string, unknown>, resourceId?: string) => { await dashboardApi.collection(guildId, collection, method, payload, resourceId); await load(); };

  return (
    <DashboardShell guildName={data.guild.name} accessLevel={data.guild.accessLevel as AccessLevel} activeSection="overview">
      <Overview health={data.health} accessLevel={data.guild.accessLevel as AccessLevel} />
      <div id="channels" className="bd-module-anchor"><ConfigMapEditor title="Canais e logs" column="channels" values={configMap('channels')} fields={channelFields} channels={channels} onSave={saveMap} /></div>
      <div id="roles" className="bd-module-anchor"><ConfigMapEditor title="Cargos operacionais" column="roles" values={configMap('roles')} fields={roleFields} roles={roles} onSave={saveMap} /><AccessEditor users={accessMap.users} roles={accessMap.roles} availableRoles={roles} canManage={data.guild.canManageAccess} onSave={async (access) => { await dashboardApi.updateAccess(guildId, access.users, access.roles); setAccessMap(access); }} /></div>
      <div id="moderation" className="bd-module-anchor"><ConfigMapEditor title="Preferências gerais" column="settings" values={configMap('settings')} fields={settingFields} channels={channels} roles={roles} onSave={saveMap} /></div>
      <div id="security" className="bd-module-anchor"><ConfigMapEditor title="Módulos e proteções" column="toggles" values={configMap('toggles')} fields={toggleFields} onSave={saveMap} /></div>
      <div id="modules" className="bd-module-anchor">
        <CollectionEditor title="Categorias de tickets" collection="ticket-categories" items={data.collections.ticketCategories ?? []} fields={[{key:'name',label:'Nome',kind:'string'},{key:'description',label:'Descrição',kind:'string'},{key:'position',label:'Posição',kind:'number'}]} onCreate={(payload) => mutateCollection('ticket-categories','POST',payload)} onUpdate={(id,payload) => mutateCollection('ticket-categories','PATCH',payload,id)} />
        <CollectionEditor title="Itens da loja" collection="shop-items" items={data.collections.shopItems ?? []} fields={[{key:'name',label:'Nome',kind:'string'},{key:'type',label:'Tipo',kind:'string'},{key:'price',label:'Preço',kind:'number'}]} onCreate={(payload) => mutateCollection('shop-items','POST',payload)} onUpdate={(id,payload) => mutateCollection('shop-items','PATCH',payload,id)} onDelete={(id) => mutateCollection('shop-items','DELETE',{},id)} />
      </div>
    </DashboardShell>
  );
}
