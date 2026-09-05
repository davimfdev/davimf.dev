// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import About from '../About';

afterEach(cleanup);

const renderAbout = () =>
  render(<MemoryRouter><LanguageProvider><About /></LanguageProvider></MemoryRouter>);

/**
 * A seção de projetos e a seção de Stack (STACK_GROUPS) compartilham nomes de
 * tecnologia - "Java", "Nginx" e "Mercado Pago" existem nas duas. As
 * asserções sobre tags de projeto precisam ficar restritas à primeira
 * `<section>` (projetos); a Stack é a segunda.
 */
const getProjectsSection = (container: HTMLElement) => {
  const section = container.querySelectorAll('section')[0];
  if (!section) throw new Error('seção de projetos não encontrada');
  return within(section);
};

describe('página /about', () => {
  it('descreve o trabalho: produtos, sob medida e ferramentas', () => {
    renderAbout();
    expect(screen.getByText('PRODUTOS')).toBeDefined();
    expect(screen.getByText('SOB MEDIDA')).toBeDefined();
    expect(screen.getAllByText(/watchdogs/i).length).toBeGreaterThan(0);
  });

  it('traz a stack, que saiu da Home', () => {
    renderAbout();
    for (const grupo of ['RUNTIME', 'DATA', 'INFRA', 'PLATFORMS']) {
      expect(screen.getByText(grupo)).toBeDefined();
    }
  });

  it('mostra cada projeto com suas tecnologias principais', () => {
    const { container } = renderAbout();
    const projects = getProjectsSection(container);
    expect(projects.getByText('FiveM Mod Manager')).toBeDefined();
    // O FMM é Go; o BaseBot é Java. Se as tags viessem de um lugar só, ou se o
    // slice pegasse as três erradas, isto quebra.
    expect(projects.getByText('Go')).toBeDefined();
    expect(projects.getByText('Wails')).toBeDefined();
    expect(projects.getByText('Java')).toBeDefined();
    expect(projects.getByText('Next.js')).toBeDefined();
  });

  it('mostra só as três primeiras tags de cada projeto', () => {
    const { container } = renderAbout();
    const projects = getProjectsSection(container);
    // davimf.dev tem oito tecnologias; o About é resumo, o /portfolio é o
    // completo. Nginx é a oitava e não pode aparecer aqui.
    expect(projects.queryByText('Nginx')).toBeNull();
    expect(projects.queryByText('Mercado Pago')).toBeNull();
  });

  it('leva ao índice completo de projetos', () => {
    renderAbout();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/portfolio');
  });

  /**
   * O defeito que originou esta página: About e Home usavam literalmente as
   * mesmas chaves de tradução, então diziam a mesma coisa com outro layout.
   */
  it('não repete o texto que a Home usa', () => {
    renderAbout();
    // O teaser curto pertence à Home; a intro longa pertence a esta página.
    expect(screen.queryByText(/Comecei resolvendo problemas meus/)).toBeNull();
  });

  it('leva ao contato e não é uma bio em card', () => {
    const { container } = renderAbout();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/contact');
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
