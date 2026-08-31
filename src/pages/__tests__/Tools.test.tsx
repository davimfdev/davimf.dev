// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import Tools from '../Tools';

afterEach(cleanup);

const renderTools = () =>
  render(<MemoryRouter><LanguageProvider><Tools /></LanguageProvider></MemoryRouter>);

describe('página /tools', () => {
  it('lista as seis ferramentas apontando para rotas reais', () => {
    renderTools();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/notes', '/encurtador', '/finances', '/password-generator', '/todo', '/roulette',
    ]);
  });

  it('substitui o dropdown por linhas, não por cards', () => {
    const { container } = renderTools();
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('.rounded-panel')).toBeNull();
  });
});
