// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkBlock } from '../WorkBlock';

afterEach(cleanup);

const shots = [
  { src: '/work/a.png', label: 'MODS', alt: 'Tela de mods', scale: 1.9, offsetX: -6, offsetY: -4 },
  { src: '/work/b.png', label: 'OTIMIZAÇÃO', alt: 'Tela de otimização', scale: 2.1, offsetX: -10, offsetY: -12 },
];

const renderBlock = (mirrored = false) =>
  render(
    <MemoryRouter>
      <WorkBlock
        kicker="01 / PRODUCT"
        title="FiveM Mod Manager"
        description="Ative e desative mods com um clique."
        tags="WINDOWS · MODS"
        link="Ver FMM"
        href="/products"
        shots={shots}
        mirrored={mirrored}
      />
    </MemoryRouter>,
  );

describe('WorkBlock', () => {
  it('mostra numeração, título e link', () => {
    renderBlock();
    expect(screen.getByText('01 / PRODUCT')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('FiveM Mod Manager');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products');
  });

  /** Toda imagem precisa de alt: a captura é conteúdo, não decoração. */
  it('cada captura tem texto alternativo e carrega preguiçosamente', () => {
    renderBlock();
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image.getAttribute('alt')).toBeTruthy();
      expect(image.getAttribute('loading')).toBe('lazy');
    }
  });

  /**
   * Spec §4: o violeta do FMM só pode existir DENTRO do retângulo da captura.
   * A moldura e os rótulos são neutros.
   */
  it('a moldura não repete a cor do produto', () => {
    const { container } = renderBlock();
    const frames = container.querySelectorAll('[data-shot-frame]');
    expect(frames.length).toBe(2);
    for (const frame of frames) {
      const classes = frame.className.split(/\s+/);
      expect(classes).toContain('border-line');
      expect(classes.some((c) => c.includes('violet') || c.includes('indigo') || c.includes('purple'))).toBe(false);
    }
  });

  it('espelha a composição quando pedido', () => {
    const { container } = renderBlock(true);
    expect(container.querySelector('[data-work-media]')?.className).toContain('lg:order-1');
  });
});
