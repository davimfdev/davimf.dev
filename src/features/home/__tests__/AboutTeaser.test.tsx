// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import { AboutTeaser } from '../AboutTeaser';

afterEach(cleanup);

describe('AboutTeaser', () => {
  it('mostra a declaração e leva para a página dedicada', () => {
    render(<MemoryRouter><LanguageProvider><AboutTeaser /></LanguageProvider></MemoryRouter>);
    expect(screen.getByText(/construo backend/i)).toBeDefined();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/about')).toBe(true);
  });

  /** Spec §5.7: bloco tipográfico, sem card e sem foto. */
  it('não é um card', () => {
    const { container } = render(<MemoryRouter><LanguageProvider><AboutTeaser /></LanguageProvider></MemoryRouter>);
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
