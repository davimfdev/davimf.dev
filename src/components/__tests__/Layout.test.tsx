// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('fica alcançável pelo menu do avatar depois do login', async () => {
    localStorage.setItem('discord_token', 'discord-access-token');
    renderLayout('/');

    // A navbar nova não tem mais o pill dedicado: o painel só é alcançável
    // abrindo o menu do avatar, que é onde o link mora agora.
    const avatarButton = await screen.findByRole('button', { name: 'Conta' });
    fireEvent.click(avatarButton);

    const link = await screen.findByRole('link', { name: 'Painel do Bot' });
    expect(link.getAttribute('href')).toBe('/dashboard');
    // Só esse ponto de entrada — o pill fora do dropdown não existe mais.
    expect(screen.getAllByRole('link', { name: 'Painel do Bot' })).toHaveLength(1);
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

describe('Layout — navbar como régua', () => {
  it('a navbar não tem mais o contêiner em pill', () => {
    render(<MemoryRouter><LanguageProvider><Layout><div /></Layout></LanguageProvider></MemoryRouter>);
    const nav = document.querySelector('nav');
    expect(nav).not.toBeNull();
    // O pill era um contêiner com fundo e raio dentro da nav. A barra nova é
    // uma régua: fundo e borda pertencem à própria nav, não a um filho.
    expect(nav?.querySelector('.rounded-2xl')).toBeNull();
  });

  it('mostra os quatro itens da navegação nova e não mostra Contato', () => {
    render(<MemoryRouter><LanguageProvider><Layout><div /></Layout></LanguageProvider></MemoryRouter>);
    for (const item of ['Projetos', 'Produtos', 'Ferramentas', 'Sobre']) {
      expect(screen.getAllByText(item).length).toBeGreaterThan(0);
    }
    // Contato sai da nav; continua alcançável pelo fecho da Home e pelo footer.
    expect(screen.queryByRole('link', { name: 'Contato' })).toBeNull();
  });

  it('todo item da navbar aponta para uma rota registrada no App', () => {
    // Comparar hrefs com um array escrito à mão prova só que a lista bate com
    // ela mesma. Aqui a fonte é o App: apagar uma rota de lá quebra este teste,
    // que é a regressão que aconteceu de verdade — dois itens da barra ficaram
    // apontando para lugar nenhum e nada avisou.
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
    const registered = new Set(
      [...app.matchAll(/path="([^"]+)"/g)].map((match) => match[1]),
    );

    renderLayout('/');
    const hrefs = ['Projetos', 'Produtos', 'Ferramentas', 'Sobre'].map(
      (nome) => screen.getAllByRole('link', { name: nome })[0].getAttribute('href')!,
    );

    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      expect(registered, `${href} não está registrado em App.tsx`).toContain(href);
    }
  });

  it('o toggle de idioma continua presente', () => {
    render(<MemoryRouter><LanguageProvider><Layout><div /></Layout></LanguageProvider></MemoryRouter>);
    expect(screen.getByLabelText('Toggle language')).toBeDefined();
  });

  it('a navbar tem um único indicador compartilhado, não um sublinhado por link', () => {
    renderLayout('/products');
    // Um traço por link voltaria a ser uma troca abrupta; o pedido é deslizar.
    expect(document.querySelectorAll('[data-nav-indicator]')).toHaveLength(1);
  });

  it('o rótulo acessível da conta vem das traduções, não cravado', async () => {
    const user = userEvent.setup();
    renderLayout('/');

    // Em PT o rótulo é "Conta". Se estivesse cravado, continuaria "Conta"
    // depois de trocar o idioma — e é exatamente isso que este teste pega.
    expect(screen.getByLabelText('Conta')).toBeDefined();

    await user.click(screen.getByLabelText('Toggle language'));

    expect(screen.getByLabelText('Account')).toBeDefined();
    expect(screen.queryByLabelText('Conta')).toBeNull();
  });

  it('o painel mobile se anuncia como diálogo e esconde o conteúdo atrás', async () => {
    const user = userEvent.setup();
    renderLayout('/');

    await user.click(screen.getByLabelText('Menu'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('main')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('footer')?.getAttribute('aria-hidden')).toBe('true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('main')?.getAttribute('aria-hidden')).toBeNull();
    expect(document.querySelector('footer')?.getAttribute('aria-hidden')).toBeNull();
  });
});
