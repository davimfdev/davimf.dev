// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import { EvidenceBand } from '../EvidenceBand';

afterEach(cleanup);

const renderBand = () =>
  render(<LanguageProvider><EvidenceBand /></LanguageProvider>);

describe('EvidenceBand', () => {
  it('mostra os três grupos de evidência', () => {
    renderBand();
    for (const label of ['PAYMENTS', 'LICENSING', 'INFRA']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('fala de coisas construídas, não de qualidades genéricas', () => {
    renderBand();
    // Spec §5.3 e §9: os três cards genéricos saem justamente porque dizem o
    // que se espera de qualquer software.
    expect(screen.queryByText(/código limpo/i)).toBeNull();
    expect(screen.queryByText(/responsivo/i)).toBeNull();
    expect(screen.getByText(/Mercado Pago/)).toBeDefined();
  });

  /** Spec §5.3: a faixa não é um card, e não pode virar um. */
  it('não usa contêiner com borda', () => {
    const { container } = renderBand();
    expect(container.querySelector('.border')).toBeNull();
    expect(container.querySelector('.glass-panel')).toBeNull();
  });
});
