import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { FileWarning } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Painel exibido quando a URL pede uma versão de documento legal que nunca
 * existiu. Não redireciona para o texto vigente: fazer isso silenciosamente
 * afirmaria um contrato que o cliente nunca aceitou. Em vez disso, avisa e
 * oferece um link explícito para o documento atual.
 *
 * A copy vem de `useLanguage()` (não de `src/content/legal`), porque este
 * aviso não é conteúdo versionado — é a mesma mensagem em qualquer versão
 * pedida, só muda com o idioma.
 */
type LegalVersionNotFoundProps = {
  version: string;
  /**
   * Caminho do documento atual, quando sabemos qual dos três era a intenção.
   * Omitido na rota de captura genérica /legal/*, onde a URL não chegou a
   * indicar um documento específico.
   */
  currentPath?: string;
  icon: LucideIcon;
};

const LegalVersionNotFound: React.FC<LegalVersionNotFoundProps> = ({ version, currentPath, icon: Icon }) => {
  const { translations } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
          <Icon size={32} className="text-accent" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient">{translations.legalVersionNotFoundTitle}</h1>
      </div>

      <div className="space-y-4 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
        <p className="leading-relaxed">
          {translations.legalVersionNotFoundPrefix}{' '}
          <span className="text-gray-100 font-semibold">{version}</span>{' '}
          {translations.legalVersionNotFoundSuffix}
        </p>
        <p className="leading-relaxed">{translations.legalVersionNotFoundExplanation}</p>

        {currentPath && (
          <Link to={currentPath} className="inline-flex items-center gap-2 text-accent hover:underline font-medium">
            <FileWarning size={18} />
            {translations.legalVersionNotFoundLink}
          </Link>
        )}
      </div>
    </div>
  );
};

export default LegalVersionNotFound;
