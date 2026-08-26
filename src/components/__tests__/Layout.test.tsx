// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Layout from '../Layout';
import { LanguageProvider } from '../../context/LanguageContext';

const DISCORD_USER = { id: '344214477069221888', username: 'davi', global_name: 'Davi', avatar: 'abc' };

/** Expõe a rota atual para detectar redirecionamento indevido após o login. */
function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderLayout(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LanguageProvider>
        <Layout><LocationProbe /></Layout>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(DISCORD_USER), { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Layout — retorno do login com Discord', () => {
  it('mantém o usuário na página onde ele estava quando o token volta na URL', async () => {
    // Estado logo após o /api/callback redirecionar de volta para /finances?token=...
    window.history.replaceState({}, '', '/finances?token=discord-access-token');
    renderLayout('/finances');

    await waitFor(() => expect(screen.getAllByText('Painel do Bot').length).toBeGreaterThan(0));

    expect(screen.getByTestId('path').textContent).toBe('/finances');
    expect(localStorage.getItem('discord_token')).toBe('discord-access-token');
    // O token some da barra de endereço, mas a rota continua a mesma.
    expect(window.location.pathname).toBe('/finances');
    expect(window.location.search).toBe('');
  });

  it('não redireciona para /dashboard quem já estava logado ao abrir uma página', async () => {
    localStorage.setItem('discord_token', 'discord-access-token');
    renderLayout('/todo');

    await waitFor(() => expect(screen.getAllByText('Painel do Bot').length).toBeGreaterThan(0));

    expect(screen.getByTestId('path').textContent).toBe('/todo');
  });
});

describe('Layout — botão do Painel do Bot', () => {
  it('aparece na navbar depois do login', async () => {
    localStorage.setItem('discord_token', 'discord-access-token');
    renderLayout('/');

    // Dois pontos de entrada no desktop: o botão dedicado da navbar e o item
    // que já existia no dropdown do avatar. O menu mobile só renderiza aberto.
    const links = await screen.findAllByRole('link', { name: /Painel do Bot/ });
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute('href') === '/dashboard')).toBe(true);

    // O botão da navbar fica fora do dropdown, visível sem nenhum clique.
    const navbarButton = links.find((link) => link.closest('[class*="space-x-4"]'));
    expect(navbarButton).toBeDefined();
  });

  it('não aparece para visitante deslogado', async () => {
    renderLayout('/');

    await screen.findByText('Entrar com Discord');
    expect(screen.queryByText('Painel do Bot')).toBeNull();
  });

  it('some quando o token guardado é rejeitado pelo Discord', async () => {
    localStorage.setItem('discord_token', 'token-expirado');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    renderLayout('/');

    await waitFor(() => expect(localStorage.getItem('discord_token')).toBeNull());
    expect(screen.queryByText('Painel do Bot')).toBeNull();
  });
});
