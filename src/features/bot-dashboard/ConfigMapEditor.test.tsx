// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConfigMapEditor, type ConfigField } from './ConfigMapEditor';

afterEach(cleanup);

const fields: ConfigField[] = [{ key: 'moderador', label: 'Moderador', kind: 'role' }];

describe('ConfigMapEditor role field', () => {
  it('renders a SelectField whose option picks a role by id', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfigMapEditor title="Cargos" column="roles" values={{}} fields={fields}
        roles={[{ id: 'r1', name: 'Moderador', color: 0x5865f2 }]} onSave={onSave} />,
    );
    // open the dropdown (the field trigger button, not the submit button)
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Moderador' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await screen.findByText('Alterações salvas.');
    expect(onSave).toHaveBeenCalledWith('roles', { moderador: 'r1' });
  });
});
