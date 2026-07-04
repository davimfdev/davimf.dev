import { ArrowUpRight, Bot, Headphones, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AccessLevel, DashboardGuild } from './types';
import './dashboard.css';

const accessLabels: Record<AccessLevel, string> = {
  support: 'Suporte global',
  owner: 'Proprietário',
  delegate: 'Acesso delegado',
};

function isRecentlySeen(value?: string) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < 15 * 60_000;
}

export function GuildPicker({ guilds }: { guilds: DashboardGuild[] }) {
  if (guilds.length === 0) {
    return (
      <div className="bd-empty">
        <Bot aria-hidden="true" />
        <h2>Nenhum servidor disponível</h2>
        <p>O BaseBot precisa estar presente e sua conta deve ser proprietária ou possuir acesso delegado.</p>
        <a className="bd-button bd-button--primary" href="/api/dashboard-login?returnTo=/dashboard">Entrar novamente</a>
      </div>
    );
  }

  return (
    <div className="bd-guild-list">
      {guilds.map((guild) => {
        const online = isRecentlySeen(guild.lastSeenAt);
        const AccessIcon = guild.accessLevel === 'support' ? Headphones : guild.accessLevel === 'owner' ? ShieldCheck : UserRoundCog;
        return (
          <article className="bd-guild-row" key={guild.id}>
            <div className="bd-guild-avatar" aria-hidden="true">
              {guild.name.slice(0, 1).toUpperCase()}
              {guild.icon && (
                <img
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'webp'}?size=96`}
                  alt=""
                  loading="lazy"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <div className="bd-guild-main">
              <div className="bd-guild-title">
                <h2>{guild.name}</h2>
                <span className={`bd-status ${online ? 'is-good' : 'is-warning'}`}>
                  <span aria-hidden="true" />{online ? 'Sincronizado' : 'Verificar conexão'}
                </span>
              </div>
              <p><AccessIcon aria-hidden="true" size={15} /> {accessLabels[guild.accessLevel]}</p>
            </div>
            <Link className="bd-button bd-button--quiet" to={`/dashboard/${guild.id}`}>
              Configurar servidor <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
