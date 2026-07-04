import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dashboardApi, DashboardApiError, type GuildConfigResponse } from '../features/bot-dashboard/api';
import { DashboardShell } from '../features/bot-dashboard/DashboardShell';
import { Overview } from '../features/bot-dashboard/Overview';
import type { AccessLevel } from '../features/bot-dashboard/types';

export default function BotConfig() {
  const { guildId = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<GuildConfigResponse | null>(null);
  const [error, setError] = useState<DashboardApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await dashboardApi.config(guildId)); }
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

  return (
    <DashboardShell guildName={data.guild.name} accessLevel={data.guild.accessLevel as AccessLevel} activeSection="overview">
      <Overview health={data.health} accessLevel={data.guild.accessLevel as AccessLevel} />
      <section id="channels" className="bd-module-anchor"><h2>Canais e logs</h2><p>Escolha canais sincronizados e valide as permissões antes de salvar.</p></section>
      <section id="roles" className="bd-module-anchor"><h2>Cargos e acessos</h2><p>Configure cargos operacionais e delegações do dashboard.</p></section>
      <section id="moderation" className="bd-module-anchor"><h2>Moderação</h2><p>Políticas, avisos e escalonamento do servidor.</p></section>
      <section id="security" className="bd-module-anchor"><h2>Segurança</h2><p>Automod, verificação, antiraid e antinuke.</p></section>
      <section id="modules" className="bd-module-anchor"><h2>Módulos</h2><p>Comunidade, níveis, economia, eventos, tickets, facções, self-roles e quiz.</p></section>
    </DashboardShell>
  );
}
