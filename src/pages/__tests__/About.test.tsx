// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import About from '../About';

afterEach(cleanup);

const renderAbout = () =>
  render(<MemoryRouter><LanguageProvider><About /></LanguageProvider></MemoryRouter>);

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
    expect(screen.getByRole('link').getAttribute('href')).toBe('/contact');
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
