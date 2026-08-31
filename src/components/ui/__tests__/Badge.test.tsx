// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import { Eyebrow } from '../Eyebrow';

afterEach(cleanup);

describe('Badge', () => {
  it('usa o tom neutral por padrão', () => {
    render(<Badge>ATIVA</Badge>);
    expect(screen.getByText('ATIVA').className.split(/\s+/)).toContain('text-fg-muted');
  });

  it('aplica o tom pedido', () => {
    render(<Badge tone="danger">REVOGADA</Badge>);
    expect(screen.getByText('REVOGADA').className.split(/\s+/)).toContain('text-danger');
  });

  /**
   * `warn` e `accent` são vizinhos no espectro (spec §4): o tom de aviso não
   * pode depender só de cor, então carrega borda própria.
   */
  it('o tom warn tem borda própria, não só cor', () => {
    render(<Badge tone="warn">PENDENTE</Badge>);
    expect(screen.getByText('PENDENTE').className.split(/\s+/)).toContain('border-warn');
  });
});

describe('Eyebrow', () => {
  it('renderiza um <span> com a escala de eyebrow', () => {
    render(<Eyebrow>SISTEMA</Eyebrow>);
    const eyebrow = screen.getByText('SISTEMA');
    expect(eyebrow.tagName).toBe('SPAN');
    expect(eyebrow.className.split(/\s+/)).toContain('text-eyebrow');
    expect(eyebrow.className.split(/\s+/)).toContain('uppercase');
  });

  it('vira outro elemento com `as`', () => {
    render(<Eyebrow as="h2">SEÇÃO</Eyebrow>);
    expect(screen.getByText('SEÇÃO').tagName).toBe('H2');
  });
});
