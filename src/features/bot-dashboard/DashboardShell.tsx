import type { ReactNode } from 'react';
import { Activity, ArrowLeft, Bot, ChevronDown, Headphones, HelpCircle, LayoutDashboard, LogOut, Menu, Settings, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { AccessLevel } from './types';
import './dashboard.css';

type Props = {
  children: ReactNode;
  guildName: string;
  accessLevel: AccessLevel;
};

const sections = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'channels', label: 'Canais e logs', icon: Activity },
  { id: 'roles', label: 'Cargos e acessos', icon: Users },
  { id: 'moderation', label: 'Moderação', icon: Shield },
  { id: 'security', label: 'Segurança', icon: SlidersHorizontal },
  { id: 'modules', label: 'Módulos', icon: Settings },
];

export function DashboardShell({ children, guildName, accessLevel }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bd-shell">
      <nav className="bd-rail" aria-label="Navegação global do dashboard">
        <Link className="bd-rail-brand" to="/dashboard" aria-label="BaseBot"><Bot /></Link>
        <div className="bd-rail-actions">
          <Link to="/dashboard" aria-label="Servidores"><LayoutDashboard /></Link>
          <a href="mailto:davi@davimf.dev" aria-label="Ajuda"><HelpCircle /></a>
        </div>
        <button type="button" aria-label="Sair" onClick={() => { void fetch('/api/dashboard-logout', { method: 'POST', credentials: 'include' }).finally(() => { window.location.href = '/'; }); }}><LogOut /></button>
      </nav>

      <button className="bd-mobile-menu" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <X /> : <Menu />} <span>Menu do servidor</span>
      </button>

      <aside className={`bd-sidebar ${open ? 'is-open' : ''}`}>
        <Link className="bd-back" to="/dashboard"><ArrowLeft /> Todos os servidores</Link>
        <button className="bd-server-switch" type="button">
          <span className="bd-server-mark">{guildName.slice(0, 1).toUpperCase()}</span>
          <span><small>Servidor atual</small><strong>{guildName}</strong></span>
          <ChevronDown aria-hidden="true" />
        </button>
        {accessLevel === 'support' && (
          <div className="bd-support-note"><Headphones aria-hidden="true" /><span><strong>Modo suporte</strong>Alterações ficam vinculadas à sua conta.</span></div>
        )}
        <nav className="bd-section-nav" aria-label="Configurações do servidor">
          {sections.map(({ id, label, icon: Icon }) => (
            <NavLink key={id} to={id} className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setOpen(false)}>
              <Icon aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="bd-sidebar-health"><span className="is-good" /><div><strong>BaseBot conectado</strong><small>Snapshots monitorados</small></div></div>
      </aside>

      <main className="bd-main">{children}</main>
    </div>
  );
}
