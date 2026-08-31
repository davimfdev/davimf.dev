// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import { ContactClose } from '../ContactClose';

afterEach(cleanup);

const renderClose = () =>
  render(<MemoryRouter><LanguageProvider><ContactClose /></LanguageProvider></MemoryRouter>);

describe('ContactClose', () => {
  it('fecha a narrativa com o convite e leva ao contato', () => {
    renderClose();
    // Uma das três portas que substituíram o item removido da navbar.
    expect(screen.getByRole('link').getAttribute('href')).toBe('/contact');
  });

  it('não traz formulário para a Home', () => {
    // O formulário continua em /contact. Duplicá-lo aqui criaria dois lugares
    // para manter o mesmo fluxo de envio.
    const { container } = renderClose();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });
});
