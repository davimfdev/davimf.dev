import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DashboardShell } from '../DashboardShell';

describe('DashboardShell', () => {
  it('combines the global rail, contextual navigation and support notice', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DashboardShell guildName="Comunidade Aurora" accessLevel="support" activeSection="overview">
          <p>Conteúdo</p>
        </DashboardShell>
      </MemoryRouter>,
    );
    expect(html).toContain('BaseBot');
    expect(html).toContain('Comunidade Aurora');
    expect(html).toContain('Visão geral');
    expect(html).toContain('Modo suporte');
  });
});
