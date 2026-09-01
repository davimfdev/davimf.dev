// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { ScrollToTop } from '../ScrollToTop';

afterEach(cleanup);

/**
 * `MemoryRouter` reporta 'POP' na renderização inicial e 'PUSH' depois de um
 * `navigate()`/clique em `Link` — por isso os testes navegam de verdade em
 * vez de mockar `useNavigationType`, que exercitaria a asserção, não o
 * comportamento real do roteador.
 */
function Page({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <span>{label}</span>
      <Link to="/destino">ir</Link>
      {children}
    </div>
  );
}

function renderApp(initialPath: string, extraAtDestino?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Page label="origem" />} />
        <Route path="/destino" element={<Page label="destino">{extraAtDestino}</Page>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScrollToTop', () => {
  it('PUSH para uma rota nova rola para o topo', async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal('scrollTo', scrollToMock);
    const user = userEvent.setup();

    const { getByText } = renderApp('/');
    // A navegação inicial (render) é um POP — não deve chamar scrollTo.
    expect(scrollToMock).not.toHaveBeenCalled();

    await user.click(getByText('ir'));

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });

    vi.unstubAllGlobals();
  });

  it('um hash na localização rola até o elemento correspondente, não até o topo', async () => {
    const scrollToMock = vi.fn();
    const scrollIntoViewMock = vi.fn();
    vi.stubGlobal('scrollTo', scrollToMock);
    const user = userEvent.setup();

    function NavigateToHash() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/destino#alvo')}>ir com hash</button>;
    }

    const { getByText } = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<NavigateToHash />} />
          <Route
            path="/destino"
            element={
              <div id="alvo" ref={(el) => { if (el) el.scrollIntoView = scrollIntoViewMock; }}>
                alvo
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(getByText('ir com hash'));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    expect(scrollToMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('um hash sem elemento correspondente cai para o topo', async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal('scrollTo', scrollToMock);
    const user = userEvent.setup();

    function NavigateToHash() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/destino#nao-existe')}>ir</button>;
    }

    const { getByText } = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<NavigateToHash />} />
          <Route path="/destino" element={<div>destino</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(getByText('ir'));

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });

    vi.unstubAllGlobals();
  });

  it('uma navegação POP (voltar) não rola nada — o navegador já restaura a posição', async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal('scrollTo', scrollToMock);
    const user = userEvent.setup();

    function BackButton() {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>voltar</button>;
    }

    const { getByText, findByText } = render(
      <MemoryRouter initialEntries={['/', '/destino']} initialIndex={1}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<div>origem</div>} />
          <Route path="/destino" element={<BackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    await findByText('voltar');
    scrollToMock.mockClear();

    await user.click(getByText('voltar'));
    await findByText('origem');

    expect(scrollToMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
