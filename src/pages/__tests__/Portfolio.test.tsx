// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import Portfolio from '../Portfolio';

afterEach(cleanup);

const renderPortfolio = () =>
  render(<MemoryRouter><LanguageProvider><Portfolio /></LanguageProvider></MemoryRouter>);

/**
 * Nomes de tecnologia aparecem tanto na fileira de chips do filtro quanto nas
 * tags de cada projeto na lista. Um `getByText('Go')` sem escopo bate nos
 * dois lugares e explode. Os chips são `<button>`; as tags de projeto são
 * `<span>` (Badge) dentro da `<ul role="list">`. Usamos os roles para
 * escopar em vez de depender de estrutura de DOM.
 */
const getList = () => screen.getByRole('list');
const getChip = (name: string) => screen.getByRole('button', { name });

describe('página /portfolio', () => {
  it('lista os cinco projetos quando nada está selecionado', () => {
    renderPortfolio();
    const list = within(getList());
    expect(list.getAllByRole('listitem')).toHaveLength(5);
    expect(list.getByText('FiveM Mod Manager')).toBeDefined();
    expect(list.getByText('BaseBot')).toBeDefined();
    expect(list.getByText('davimf.dev')).toBeDefined();
    expect(list.getByText('boasvindas.online')).toBeDefined();
    expect(list.getByText('Ferramentas')).toBeDefined();
  });

  it('clicar no chip Go deixa só o FMM visível, e clicar de novo restaura os cinco', () => {
    renderPortfolio();
    const goChip = getChip('Go');

    fireEvent.click(goChip);
    let list = within(getList());
    expect(list.getAllByRole('listitem')).toHaveLength(1);
    expect(list.getByText('FiveM Mod Manager')).toBeDefined();

    fireEvent.click(goChip);
    list = within(getList());
    expect(list.getAllByRole('listitem')).toHaveLength(5);
  });

  it('selecionar Go e Java mostra FMM e BaseBot (filtro é OR, não AND)', () => {
    renderPortfolio();
    fireEvent.click(getChip('Go'));
    fireEvent.click(getChip('Java'));

    const list = within(getList());
    expect(list.getAllByRole('listitem')).toHaveLength(2);
    expect(list.getByText('FiveM Mod Manager')).toBeDefined();
    expect(list.getByText('BaseBot')).toBeDefined();
  });

  it('chips expõem aria-pressed refletindo o estado', () => {
    renderPortfolio();
    const goChip = getChip('Go');
    expect(goChip.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(goChip);
    expect(goChip.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(goChip);
    expect(goChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('mostra a lista completa de tags de um projeto que o /about trunca (Nginx aparece aqui)', () => {
    renderPortfolio();
    const list = within(getList());
    expect(list.getByText('Nginx')).toBeDefined();
  });
});
