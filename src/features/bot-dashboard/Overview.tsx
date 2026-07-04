import { Activity, AlertTriangle, CheckCircle2, Radio, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Health } from './api';
import type { AccessLevel } from './types';

const accessLabel: Record<AccessLevel, string> = { support: 'Suporte global', owner: 'Proprietário', delegate: 'Delegado' };

export function Overview({ health, accessLevel }: { health: Health; accessLevel: AccessLevel }) {
  const status = String(health.status ?? health.snapshotStatus ?? 'unknown');
  const stale = status === 'stale';
  const blocked = status === 'blocked' || status === 'offline';
  const title = blocked ? 'Configuração temporariamente bloqueada' : stale ? 'Sincronização atrasada' : 'BaseBot pronto para configurar';
  const StatusIcon = blocked || stale ? AlertTriangle : CheckCircle2;
  const channels = Number(health.channelCount ?? health.channelsCount ?? 0);
  const roles = Number(health.roleCount ?? health.rolesCount ?? 0);
  return (
    <section id="overview" className="bd-overview" aria-labelledby="bd-overview-title">
      <header className="bd-page-header">
        <div><p>Central de configuração</p><h1 id="bd-overview-title">Visão geral</h1><span>Saúde, acesso e próximos passos do seu servidor.</span></div>
        <span className={`bd-health-pill ${blocked ? 'is-bad' : stale ? 'is-warning' : 'is-good'}`}><StatusIcon />{title}</span>
      </header>
      <div className="bd-health-strip">
        <div><Radio /><span><small>Conexão</small><strong>{blocked ? 'Requer atenção' : 'Bot presente'}</strong></span></div>
        <div><Activity /><span><small>Recursos sincronizados</small><strong>{channels} canais · {roles} cargos</strong></span></div>
        <div><ShieldCheck /><span><small>Seu acesso</small><strong>{accessLabel[accessLevel]}</strong></span></div>
      </div>
      {(stale || blocked) && <div className="bd-guidance"><AlertTriangle /><div><strong>{title}</strong><p>Mantenha o bot online e aguarde a próxima publicação de canais e cargos antes de salvar campos dependentes do Discord.</p></div></div>}
      <div className="bd-next-grid">
        <article><span><Activity /> Base operacional</span><h2>Revise canais e logs</h2><p>Direcione eventos importantes para canais onde o bot consegue visualizar e enviar mensagens.</p><Link to="../channels">Abrir canais</Link></article>
        <article><span><Users /> Governança</span><h2>Organize cargos e acessos</h2><p>Defina cargos operacionais e delegue a configuração sem compartilhar credenciais.</p><Link to="../roles">Abrir acessos</Link></article>
      </div>
    </section>
  );
}
