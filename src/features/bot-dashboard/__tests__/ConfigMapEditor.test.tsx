// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfigMapEditor, type ConfigField } from '../ConfigMapEditor';

afterEach(cleanup);

describe('ConfigMapEditor', () => {
  it('renders channel, role, boolean, numeric and text controls from field definitions', () => {
    const html = renderToStaticMarkup(<ConfigMapEditor
      title="Operação"
      column="settings"
      values={{ channel: '10', role: '20', enabled: true, limit: 4, message: 'Olá' }}
      fields={[
        { key: 'channel', label: 'Canal', kind: 'channel' },
        { key: 'role', label: 'Cargo', kind: 'role' },
        { key: 'enabled', label: 'Ativo', kind: 'boolean' },
        { key: 'limit', label: 'Limite', kind: 'number' },
        { key: 'message', label: 'Mensagem', kind: 'string' },
      ]}
      channels={[{ id: '10', name: 'geral' }]}
      roles={[{ id: '20', name: 'Staff' }]}
      onSave={async () => undefined}
    />);
    expect(html).toContain('#geral');
    expect(html).toContain('bd-role-name">Staff');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('type="number"');
    expect(html).toContain('Salvar alterações');
  });

  it('picks a role by id through the SelectField dropdown', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfigMapEditor title="Cargos" column="roles" values={{}}
        fields={[{ key: 'moderador', label: 'Moderador', kind: 'role' } as ConfigField]}
        roles={[{ id: 'r1', name: 'Moderador', color: 0x5865f2 }]} onSave={onSave} />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Moderador' }));
    expect(screen.queryByRole('combobox')).toBeNull(); // popover closed on select
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await screen.findByText('Alterações salvas.');
    expect(onSave).toHaveBeenCalledWith('roles', { moderador: 'r1' });
  });
});
