// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import Home from '../Home';

afterEach(cleanup);

const renderHome = () =>
  render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>);

describe('Home', () => {
  /**
   * A Stack saiu da Home (ver About.test.tsx, "traz a stack, que saiu da
   * Home"): a Home é a landing, /about é a página completa. Não há marco
   * STACK aqui — testá-lo faria a suíte exigir algo que a própria produto
   * decidiu remover.
   *
   * A ordem é lida do DOM, não de uma busca textual: `indexOf` sobre
   * `document.body.textContent` acharia a primeira ocorrência TEXTUAL do
   * rótulo em qualquer lugar da página, não a posição do elemento — um rótulo
   * repetido (ex.: em copy ou aria-label) faria o teste mentir sobre a ordem
   * real. `compareDocumentPosition` compara os nós de fato.
   */
  it('compõe as seções na ordem da narrativa', () => {
    renderHome();
    const marcos = ['SELECTED WORK', 'TOOLS', 'ABOUT'];
    const nodes = marcos.map((label) => screen.getByText(label));

    for (let i = 0; i < nodes.length - 1; i += 1) {
      const posicao = nodes[i].compareDocumentPosition(nodes[i + 1]);
      expect(posicao & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  /** Spec §9: nada do portfólio genérico sobrevive. */
  it('não sobrou nada do portfólio genérico', () => {
    renderHome();
    for (const texto of [/me chamo/i, /código limpo/i, /ui\/ux moderno/i, /^responsivo$/i]) {
      expect(screen.queryByText(texto)).toBeNull();
    }
  });

  /** Spec §6: sem backend real, nenhum número operacional pode aparecer. */
  it('não exibe telemetria inventada', () => {
    renderHome();
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/\d+(\.\d+)?%\s*uptime/i);
    expect(texto).not.toMatch(/\d+\s+containers?/i);
    expect(texto).not.toMatch(/\d+\s+deploys?/i);
  });

  /** A Stack pertence só a /about; a Home é a landing, não o índice completo. */
  it('não traz a seção Stack', () => {
    renderHome();
    expect(screen.queryByText('STACK')).toBeNull();
  });
});
