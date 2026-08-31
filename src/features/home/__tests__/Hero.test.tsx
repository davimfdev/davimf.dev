// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import { Hero } from '../Hero';

afterEach(cleanup);

const renderHero = () =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <Hero />
      </LanguageProvider>
    </MemoryRouter>,
  );

describe('Hero', () => {
  it('não usa mais a saudação pessoal', () => {
    renderHero();
    expect(screen.queryByText(/me chamo/i)).toBeNull();
  });

  it('o H1 declara o que ele constrói', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('sistemas');
  });

  /**
   * Spec §5.2: destacar uma palavra do título em dourado é o gesto de landing
   * page SaaS. O dourado da dobra vive no nó central do grafo e no CTA.
   */
  it('nenhum trecho do H1 é dourado', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className.split(/\s+/)).not.toContain('text-accent');
    expect(heading.querySelector('.text-accent')).toBeNull();
  });

  it('leva a produtos e a portfolio', () => {
    renderHero();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/products');
    expect(hrefs).toContain('/portfolio');
  });

  it('o grafo nomeia o ecossistema real e é decorativo para leitores de tela', () => {
    renderHero();
    const svg = document.querySelector('svg[data-ecosystem]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.textContent).toContain('BASEBOT');
    expect(svg?.textContent).toContain('FMM');
  });
});
