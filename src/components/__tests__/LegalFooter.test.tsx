// @vitest-environment jsdom
/**
 * O que este arquivo protege:
 *  - os três documentos ficam a um clique do rodapé, em qualquer página;
 *  - a identificação do fornecedor (CNPJ) aparece no rodapé;
 *  - o aviso de cookies aparece antes de qualquer escolha e o Google Analytics
 *    NÃO é carregado até o aceite — que é o ponto inteiro do trabalho;
 *  - "Preferências de cookies" reabre a escolha, tornando a revogação tão
 *    acessível quanto o consentimento.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';
import { LanguageProvider } from '../../context/LanguageContext';
import { ANALYTICS_STORAGE_KEY, GA_MEASUREMENT_ID } from '../../features/consent/analyticsConsent';

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

function gaScript() {
  return document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
}

describe('rodapé legal e consentimento', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.querySelectorAll('script[src*="googletagmanager"]').forEach((node) => node.remove());
    vi.unstubAllGlobals();
  });

  it('linka os três documentos e identifica o fornecedor', () => {
    renderLayout();
    // Escopado ao rodapé: o aviso de cookies também linka a privacidade.
    const footer = within(screen.getByRole('contentinfo'));

    expect(footer.getByRole('link', { name: 'Termos de Uso' }).getAttribute('href')).toBe('/terms-of-service');
    expect(footer.getByRole('link', { name: 'Política de Privacidade' }).getAttribute('href')).toBe('/privacy-policy');
    expect(footer.getByRole('link', { name: 'Política de Reembolso' }).getAttribute('href')).toBe('/refund-policy');
    expect(footer.getByText(/CNPJ 66\.482\.628\/0001-89/)).toBeTruthy();
  });

  it('mostra o aviso e NÃO carrega o Google Analytics antes da escolha', () => {
    renderLayout();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(gaScript()).toBeNull();
  });

  it('recusar dispensa o aviso e mantém o Google Analytics fora da página', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gaScript()).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_STORAGE_KEY)).toBe('denied');
  });

  it('aceitar carrega o Google Analytics', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar análise' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gaScript()?.getAttribute('src')).toContain(GA_MEASUREMENT_ID);
    expect(window.localStorage.getItem(ANALYTICS_STORAGE_KEY)).toBe('granted');
  });

  it('não mostra o aviso de novo depois da escolha registrada', () => {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, 'denied');
    renderLayout();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Preferências de cookies" reabre a escolha para permitir revogar', () => {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, 'granted');
    renderLayout();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Preferências de cookies' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    expect(window.localStorage.getItem(ANALYTICS_STORAGE_KEY)).toBe('denied');
  });
});
