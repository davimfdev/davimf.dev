// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('cada uma das seis ferramentas aponta para uma rota registrada no App', () => {
    // Mesma falha que o teste da navbar tinha: comparar hrefs com um array
    // escrito à mão só prova que a lista bate com ela mesma. Aqui a fonte é
    // o App - apagar uma rota de lá quebra este teste.
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
    const registered = new Set(
      [...app.matchAll(/path="([^"]+)"/g)].map((match) => match[1]),
    );

    renderTools();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href')!);

    expect(hrefs).toHaveLength(6);
    for (const href of hrefs) {
      expect(registered, `${href} não está registrado em App.tsx`).toContain(href);
    }
  });
});
