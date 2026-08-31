// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { Button } from '../Button';

afterEach(cleanup);

describe('Button', () => {
  it('renderiza um <button> por padrão, com a variante primary', () => {
    render(<Button>Comprar</Button>);
    const button = screen.getByRole('button', { name: 'Comprar' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.className.split(/\s+/)).toContain('bg-fg');
  });

  it('aplica a variante pedida', () => {
    render(<Button variant="danger">Excluir</Button>);
    expect(screen.getByRole('button').className.split(/\s+/)).toContain('bg-danger');
  });

  it('aplica o tamanho pedido', () => {
    render(<Button size="sm">Ok</Button>);
    expect(screen.getByRole('button').className.split(/\s+/)).toContain('text-sm');
  });

  it('vira outro elemento com `as` — inclusive um componente de rota', () => {
    render(
      <MemoryRouter>
        <Button as={Link} to="/planos">Ver planos</Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Ver planos' });
    expect(link.getAttribute('href')).toBe('/planos');
  });

  it('repassa props desconhecidas ao elemento renderizado', () => {
    render(<Button type="submit" data-testid="enviar">Enviar</Button>);
    expect(screen.getByTestId('enviar').getAttribute('type')).toBe('submit');
  });

  /**
   * O site é PT/EN. Um primitivo que injetasse "Carregando…" nasceria
   * monolíngue e quebraria em inglês — por isso o estado de carga é
   * comunicado por atributo e ícone, nunca por texto próprio.
   */
  it('em loading marca aria-busy, desabilita, e NÃO injeta texto', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('disabled')).not.toBeNull();
    expect(button.textContent).toBe('Salvar');
  });

  it('aceita className adicional sem perder as classes da variante', () => {
    render(<Button className="w-full">Ok</Button>);
    const button = screen.getByRole('button');
    expect(button.className.split(/\s+/)).toContain('w-full');
    expect(button.className.split(/\s+/)).toContain('bg-fg');
  });
});
