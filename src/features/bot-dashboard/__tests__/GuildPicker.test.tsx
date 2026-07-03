import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GuildPicker } from '../GuildPicker';

describe('GuildPicker', () => {
  it('renders guild access and health context without exposing Discord ids as the primary label', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GuildPicker guilds={[{
          id: '123456789012345678', name: 'Comunidade Aurora', botPresent: true,
          lastSeenAt: new Date().toISOString(), accessLevel: 'support',
        }]} />
      </MemoryRouter>,
    );
    expect(html).toContain('Comunidade Aurora');
    expect(html).toContain('Suporte global');
    expect(html).toContain('Configurar servidor');
    expect(html).not.toContain('123456789012345678</');
  });
});
