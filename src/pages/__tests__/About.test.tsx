// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import About from '../About';

afterEach(cleanup);

describe('página /about', () => {
  it('mostra a declaração e leva ao contato', () => {
    render(<MemoryRouter><LanguageProvider><About /></LanguageProvider></MemoryRouter>);
    expect(screen.getByText(/construo backend/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/contact');
  });

  it('não é uma bio genérica em card', () => {
    const { container } = render(<MemoryRouter><LanguageProvider><About /></LanguageProvider></MemoryRouter>);
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
