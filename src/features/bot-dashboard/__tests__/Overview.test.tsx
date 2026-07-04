import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Overview } from '../Overview';

describe('Overview', () => {
  it('turns health metadata into actionable status', () => {
    const html = renderToStaticMarkup(<Overview health={{ status: 'stale', issues: ['SNAPSHOT_STALE'], channelCount: 18, roleCount: 9 }} accessLevel="owner" />);
    expect(html).toContain('Sincronização atrasada');
    expect(html).toContain('18 canais');
    expect(html).toContain('9 cargos');
    expect(html).toContain('Proprietário');
  });
});
