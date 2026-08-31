// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import { ToolsList } from '../ToolsList';

afterEach(cleanup);

const renderTools = () =>
  render(<MemoryRouter><LanguageProvider><ToolsList /></LanguageProvider></MemoryRouter>);

describe('ToolsList', () => {
  it('lista as quatro ferramentas numeradas com um link para /tools', () => {
    renderTools();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/notes', '/encurtador', '/finances', '/password-generator', '/tools',
    ]);
    for (const numero of ['01', '02', '03', '04']) {
      expect(screen.getByText(numero)).toBeDefined();
    }
  });

  /** Spec §5.6: lista técnica, não quatro cards SaaS iguais. */
  it('as linhas não são cards', () => {
    const { container } = renderTools();
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('.rounded-panel')).toBeNull();
  });
});
