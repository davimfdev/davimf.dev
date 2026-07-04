import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfigMapEditor } from '../ConfigMapEditor';

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
    expect(html).toContain('@Staff');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('type="number"');
    expect(html).toContain('Salvar alterações');
  });
});
