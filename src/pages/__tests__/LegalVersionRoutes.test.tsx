// @vitest-environment jsdom
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TermsOfService from '../TermsOfService';
import LegalCatchAll from '../LegalCatchAll';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';
import { CURRENT_LEGAL_VERSION } from '../../content/legal';

/**
 * O idioma vive só dentro do LanguageProvider (useState interno, sem prop de
 * idioma inicial), então para testar a versão em inglês do painel é preciso
 * um componente que chame setLanguage ao montar - não há outro jeito de
 * alcançar o estado a partir de fora.
 */
function LanguageSetter({ language }: { language: 'pt' | 'en' }) {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);
  return null;
}

function renderAt(path: string, language: 'pt' | 'en' = 'pt') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <LanguageSetter language={language} />
        <Routes>
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/legal/:version/terms-of-service" element={<TermsOfService />} />
          <Route path="/legal/*" element={<LegalCatchAll />} />
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
    // silenciosamente no texto atual - que seria afirmar um contrato falso.
    expect(screen.queryByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeNull();
    expect(screen.getByText(/não encontrada/i)).toBeTruthy();
  });

  it('o painel de versão desconhecida respeita o idioma ativo', () => {
    renderAt('/legal/1999-01-01-v1/terms-of-service', 'en');
    // A mesma checagem acima, mas em inglês: o aviso não pode ficar preso em
    // português dentro de uma página que o visitante está lendo em inglês.
    expect(screen.queryByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Version not found' })).toBeTruthy();
  });

  it('um caminho malformado sob /legal/ mostra o aviso em vez de página em branco', () => {
    renderAt('/legal//terms-of-service');
    expect(screen.getByText(/não encontrada/i)).toBeTruthy();
  });
});
