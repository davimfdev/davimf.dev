// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

vi.mock('../api', async (importActual) => {
  const actual = await importActual<typeof import('../api')>();
  return { ...actual, dashboardApi: { ...actual.dashboardApi, config: vi.fn(), access: vi.fn() } };
});

import { dashboardApi } from '../api';
import BotConfig from '../../../pages/BotConfig';
import { OverviewSection } from '../sections/OverviewSection';
import { ChannelsSection } from '../sections/ChannelsSection';
import { RolesSection } from '../sections/RolesSection';
import { ModerationSection } from '../sections/ModerationSection';
import { SecuritySection } from '../sections/SecuritySection';
import { ModulesSection } from '../sections/ModulesSection';

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

const fakeData = {
  guild: { id: 'g1', name: 'Aurora', accessLevel: 'owner', canManageAccess: false },
  config: { toggles: {} }, channels: [], roles: [],
  health: { channelCount: 1, roleCount: 1 }, collections: {},
};

function renderAt(path: string) {
  (dashboardApi.config as ReturnType<typeof vi.fn>).mockResolvedValue(fakeData);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/:guildId" element={<BotConfig />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewSection />} />
          <Route path="channels" element={<ChannelsSection />} />
          <Route path="roles" element={<RolesSection />} />
          <Route path="moderation" element={<ModerationSection />} />
          <Route path="security" element={<SecuritySection />} />
          <Route path="modules" element={<ModulesSection />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('dashboard routing', () => {
  it('renders the security section at /security', async () => {
    renderAt('/dashboard/g1/security');
    expect(await screen.findByText('Módulos e proteções')).toBeTruthy();
    expect(screen.queryByText('Preferências gerais')).toBeNull();
    expect(screen.queryByText('Central de configuração')).toBeNull();
  });
  it('redirects the index to overview', async () => {
    renderAt('/dashboard/g1');
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeTruthy();
    expect(screen.queryByText('Módulos e proteções')).toBeNull();
  });
  it('soft-migrates an old hash deep-link to its section', async () => {
    renderAt('/dashboard/g1#security');
    expect(await screen.findByText('Módulos e proteções')).toBeTruthy();
    expect(screen.queryByText('Central de configuração')).toBeNull();
  });
  it('loads config once and stays mounted when navigating between sections', async () => {
    renderAt('/dashboard/g1/overview');
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeTruthy();
    expect(dashboardApi.config).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: /Segurança/ }));
    expect(await screen.findByText('Módulos e proteções')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Visão geral' })).toBeNull();
    expect(dashboardApi.config).toHaveBeenCalledTimes(1);
  });
});
