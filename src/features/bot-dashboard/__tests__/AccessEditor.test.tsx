import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccessEditor } from '../AccessEditor';

describe('AccessEditor', () => {
  it('shows delegated role choices to an owner', () => {
    const html = renderToStaticMarkup(<AccessEditor users={['344214477069221888']} roles={['20']} availableRoles={[{ id: '20', name: 'Gestor' }]} canManage onSave={async () => undefined} />);
    expect(html).toContain('344214477069221888');
    expect(html).toContain('@Gestor');
    expect(html).toContain('Salvar acessos');
  });

  it('does not expose the access map to delegates', () => {
    const html = renderToStaticMarkup(<AccessEditor users={[]} roles={[]} availableRoles={[]} canManage={false} onSave={async () => undefined} />);
    expect(html).toContain('Acesso delegado');
    expect(html).not.toContain('IDs de usuários');
  });
});
