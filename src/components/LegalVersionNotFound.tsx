import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { FileWarning } from 'lucide-react';

/**
 * Painel exibido quando a URL pede uma versão de documento legal que nunca
 * existiu. Não redireciona para o texto vigente: fazer isso silenciosamente
 * afirmaria um contrato que o cliente nunca aceitou. Em vez disso, avisa e
 * oferece um link explícito para o documento atual.
 */
type LegalVersionNotFoundProps = {
  version: string;
  /** Caminho do documento atual (ex.: "/terms-of-service"), para o link de retorno. */
  currentPath: string;
  icon: LucideIcon;
};

const LegalVersionNotFound: React.FC<LegalVersionNotFoundProps> = ({ version, currentPath, icon: Icon }) => (
  <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
        <Icon size={32} className="text-accent" />
      </div>
      <h1 className="text-4xl font-extrabold text-gradient">Versão não encontrada</h1>
    </div>

    <div className="space-y-4 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
      <p className="leading-relaxed">
        A versão <span className="text-gray-100 font-semibold">{version}</span> deste documento não existe em nosso
        histórico.
      </p>
      <p className="leading-relaxed">
        Para não afirmar um contrato que você nunca aceitou, não mostramos o texto vigente no lugar dela.
      </p>
      <Link
        to={currentPath}
        className="inline-flex items-center gap-2 text-accent hover:underline font-medium"
      >
        <FileWarning size={18} />
        Ver a versão atual deste documento
      </Link>
    </div>
  </div>
);

export default LegalVersionNotFound;
