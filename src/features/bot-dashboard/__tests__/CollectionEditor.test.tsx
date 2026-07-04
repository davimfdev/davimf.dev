import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectionEditor } from '../CollectionEditor';

describe('CollectionEditor', () => {
  it('renders existing items and creation fields', () => {
    const html = renderToStaticMarkup(<CollectionEditor
      title="Loja"
      collection="shop-items"
      items={[{ id: 'vip', name: 'VIP', price: 100, enabled: true }]}
      fields={[{ key: 'name', label: 'Nome', kind: 'string' }, { key: 'price', label: 'Preço', kind: 'number' }]}
      onCreate={async () => undefined}
      onUpdate={async () => undefined}
      onDelete={async () => undefined}
    />);
    expect(html).toContain('VIP');
    expect(html).toContain('value="100"');
    expect(html).toContain('Novo item');
    expect(html).toContain('Desativar');
  });
});
