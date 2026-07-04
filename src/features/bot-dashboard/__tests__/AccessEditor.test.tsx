// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessEditor } from '../AccessEditor';

afterEach(cleanup);

describe('AccessEditor', () => {
  it('shows delegated role choices to an owner', () => {
    const html = renderToStaticMarkup(<AccessEditor users={['344214477069221888']} roles={['20']} availableRoles={[{ id: '20', name: 'Gestor' }]} canManage onSave={async () => undefined} />);
    expect(html).toContain('344214477069221888');
    expect(html).toContain('bd-role-name">Gestor');
    expect(html).not.toContain('@Gestor');
    expect(html).toContain('Salvar acessos');
  });

  it('does not expose the access map to delegates', () => {
    const html = renderToStaticMarkup(<AccessEditor users={[]} roles={[]} availableRoles={[]} canManage={false} onSave={async () => undefined} />);
    expect(html).toContain('Acesso delegado');
    expect(html).not.toContain('IDs de usuários');
  });

  it('renders selected roles as chips (no @) and removes one', () => {
    render(
      <AccessEditor canManage users={[]} roles={['r1']}
        availableRoles={[{ id: 'r1', name: 'Moderador' }, { id: 'r2', name: 'Staff' }]}
        onSave={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(screen.getByText('Moderador')).toBeTruthy();
    expect(screen.queryByText('@Moderador')).toBeNull();
    fireEvent.click(screen.getByLabelText('Remover Moderador'));
    expect(screen.queryByText('Moderador')).toBeNull();
  });
});
