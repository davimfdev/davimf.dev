// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TermsOfService from '../TermsOfService';
import { LanguageProvider } from '../../context/LanguageContext';
import { CURRENT_LEGAL_VERSION } from '../../content/legal';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <Routes>
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/legal/:version/terms-of-service" element={<TermsOfService />} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('rotas versionadas dos documentos', () => {
  it('a rota sem versão mostra o texto vigente', () => {
    renderAt('/terms-of-service');
    expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeTruthy();
  });

  it('a rota versionada mostra a versão pedida', () => {
    renderAt(`/legal/${CURRENT_LEGAL_VERSION}/terms-of-service`);
    expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeTruthy();
  });

  it('versão desconhecida não renderiza um documento inventado', () => {
    renderAt('/legal/1999-01-01-v1/terms-of-service');
    // Uma versão que nunca existiu tem de dizer isso, e não cair
    // silenciosamente no texto atual — que seria afirmar um contrato falso.
    expect(screen.queryByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeNull();
    expect(screen.getByText(/não encontrada/i)).toBeTruthy();
  });
});
