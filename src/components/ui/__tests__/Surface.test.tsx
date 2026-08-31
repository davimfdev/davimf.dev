// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Surface } from '../Surface';

afterEach(cleanup);

describe('Surface', () => {
  it('renderiza uma <div> no nível 1 com borda de linha', () => {
    render(<Surface data-testid="painel">conteúdo</Surface>);
    const surface = screen.getByTestId('painel');
    expect(surface.tagName).toBe('DIV');
    expect(surface.className.split(/\s+/)).toContain('bg-surface-1');
    expect(surface.className.split(/\s+/)).toContain('border-line');
  });

  it('aplica o nível pedido', () => {
    render(<Surface level={3} data-testid="painel">x</Surface>);
    expect(screen.getByTestId('painel').className.split(/\s+/)).toContain('bg-surface-3');
  });

  it('só ganha estado de hover quando interactive', () => {
    const { rerender } = render(<Surface data-testid="painel">x</Surface>);
    // Checagem de prefixo é o ponto aqui: qualquer classe hover:*
    // (hover:bg-surface-2, hover:border-line-strong, etc.) conta como
    // "ganhou hover", então .toContain na string bruta é intencional.
    expect(screen.getByTestId('painel').className).not.toContain('hover:');
    rerender(<Surface interactive data-testid="painel">x</Surface>);
    expect(screen.getByTestId('painel').className).toContain('hover:');
  });

  it('vira outro elemento com `as`', () => {
    render(<Surface as="section" data-testid="painel">x</Surface>);
    expect(screen.getByTestId('painel').tagName).toBe('SECTION');
  });

  it('padding none não emite classe de padding', () => {
    render(<Surface padding="none" data-testid="painel">x</Surface>);
    expect(screen.getByTestId('painel').className).not.toMatch(/\bp-\d/);
  });
});
