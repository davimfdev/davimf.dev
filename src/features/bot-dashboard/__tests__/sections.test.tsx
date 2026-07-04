// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { RolesSection } from '../sections/RolesSection';
import { SecuritySection } from '../sections/SecuritySection';
import { OverviewSection } from '../sections/OverviewSection';
import type { DashboardContext } from '../dashboardContext';
import type { GuildConfigResponse } from '../api';

afterEach(cleanup);

const data = {
  guild: { id: 'g1', name: 'Aurora', accessLevel: 'owner', canManageAccess: true },
  config: { toggles: { 'sec:automod': true } },
  channels: [], roles: [],
  health: { channelCount: 3, roleCount: 2 },
  collections: {},
} as unknown as GuildConfigResponse;

const ctx: DashboardContext = {
  guildId: 'g1',
  data,
  configMap: (key) => (data.config[key] && typeof data.config[key] === 'object' ? data.config[key] as Record<string, unknown> : {}),
  channels: [],
  roles: [{ id: 'r1', name: 'Moderador' }],
  accessMap: { users: [], roles: [] },
  setAccessMap: vi.fn(),
  saveMap: vi.fn().mockResolvedValue(undefined),
  mutateCollection: vi.fn().mockResolvedValue(undefined),
};

function renderSection(ui: ReactNode) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Outlet context={ctx} />}>
          <Route index element={ui} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('dashboard sections', () => {
  it('RolesSection renders the role editor and the access editor', () => {
    renderSection(<RolesSection />);
    expect(screen.getByText('Cargos operacionais')).toBeTruthy();
    expect(screen.getByText('Quem pode configurar')).toBeTruthy();
  });
  it('SecuritySection renders the toggles editor', () => {
    renderSection(<SecuritySection />);
    expect(screen.getByText('Módulos e proteções')).toBeTruthy();
  });
  it('OverviewSection renders the overview heading', () => {
    renderSection(<OverviewSection />);
    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeTruthy();
  });
});
