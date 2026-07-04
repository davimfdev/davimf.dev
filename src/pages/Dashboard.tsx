import { AlertTriangle, Bot, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { dashboardApi, DashboardApiError } from '../features/bot-dashboard/api';
import { GuildPicker } from '../features/bot-dashboard/GuildPicker';
import type { DashboardGuild } from '../features/bot-dashboard/types';
import '../features/bot-dashboard/dashboard.css';

export default function Dashboard() {
  const [guilds, setGuilds] = useState<DashboardGuild[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unauthorized' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const result = await dashboardApi.guilds();
      setGuilds(result);
      setState('ready');
    } catch (error) {
      setState(error instanceof DashboardApiError && error.status === 401 ? 'unauthorized' : 'error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bd-picker-page">
      <header className="bd-picker-brand"><span><Bot /> BaseBot</span><a href="/">Voltar ao davimf.dev</a></header>
      <main className="bd-picker-content">
        <div className="bd-picker-heading"><p>Painel de configuração</p><h1>Seus servidores</h1><span>Escolha onde deseja revisar a saúde e configurar o BaseBot.</span></div>
        {state === 'loading' && <div className="bd-skeleton-list" aria-label="Carregando servidores">{[0, 1, 2].map((item) => <span key={item} />)}</div>}
        {state === 'ready' && <GuildPicker guilds={guilds} />}
        {state === 'unauthorized' && (
          <div className="bd-empty"><Bot /><h2>Entre para acessar o painel</h2><p>A autenticação acontece no Discord e sua sessão fica protegida no servidor.</p><a className="bd-button bd-button--primary" href="/api/dashboard-login?returnTo=/dashboard">Entrar com Discord</a></div>
        )}
        {state === 'error' && (
          <div className="bd-empty"><AlertTriangle /><h2>Não foi possível carregar os servidores</h2><p>O painel encontrou uma falha temporária. Suas configurações não foram alteradas.</p><button className="bd-button bd-button--quiet" type="button" onClick={() => void load()}><RefreshCw /> Tentar novamente</button></div>
        )}
      </main>
    </div>
  );
}
