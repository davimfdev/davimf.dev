// @vitest-environment jsdom
/**
 * O que este arquivo protege:
 *  - os três documentos ficam a um clique do rodapé, em qualquer página;
 *  - a identificação do fornecedor (CNPJ) aparece no rodapé;
 *  - NENHUM script de análise de audiência é carregado. O site não usa
 *    rastreamento de terceiros, então também não existe aviso de cookies —
 *    e o teste falha se alguém reintroduzir a medição sem rever a política.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';
import { LanguageProvider } from '../../context/LanguageContext';

function renderLayout() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <Layout>
          <div>conteúdo</div>
        </Layout>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('rodapé legal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('linka os três documentos e identifica o fornecedor', () => {
    renderLayout();
    const footer = within(screen.getByRole('contentinfo'));

    expect(footer.getByRole('link', { name: 'Termos de Uso' }).getAttribute('href')).toBe('/terms-of-service');
    expect(footer.getByRole('link', { name: 'Política de Privacidade' }).getAttribute('href')).toBe('/privacy-policy');
    expect(footer.getByRole('link', { name: 'Política de Reembolso' }).getAttribute('href')).toBe('/refund-policy');
    expect(footer.getByText(/CNPJ 66\.482\.628\/0001-89/)).toBeTruthy();
  });

  it('não carrega script de análise de audiência', () => {
    renderLayout();

    // Nenhum host de medição, e nada do Google Analytics em particular.
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(document.querySelector('script[src*="google-analytics"]')).toBeNull();
    expect((window as unknown as Record<string, unknown>).dataLayer).toBeUndefined();
  });

  it('não exibe aviso de cookies, porque não há o que consentir', () => {
    renderLayout();

    // Pedir consentimento sem ter tratamento que dependa dele confunde o
    // usuário e sugere um rastreamento que não existe.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /cookies/i })).toBeNull();
  });
});
