import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { LegalDocument } from '../content/legal';

/**
 * Renderizador único dos três documentos legais.
 *
 * Antes cada página repetia a mesma moldura com as seções numeradas à mão, o
 * que fazia o número da seção depender da ordem escrita no JSX. Aqui a
 * numeração vem do índice do array, então inserir uma seção no meio não
 * desalinha as seguintes.
 */
type LegalPageProps = {
  document: LegalDocument;
  icon: LucideIcon;
};

const LegalPage: React.FC<LegalPageProps> = ({ document, icon: Icon }) => (
  <div className="max-w-4xl mx-auto p-8 text-fg-soft animate-fade-in relative z-10">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
        <Icon size={32} className="text-accent" />
      </div>
      <h1 className="text-4xl font-extrabold text-gradient">{document.title}</h1>
    </div>

    <p className="text-fg-muted mb-2">{document.summary}</p>
    <p className="text-sm text-fg-muted mb-10">{document.updatedAt}</p>

    <div className="space-y-8 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
      {document.sections.map((section, index) => (
        <section key={section.heading}>
          <h2 className="text-2xl font-bold mb-3 text-fg flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3 flex-shrink-0">
              {index + 1}
            </span>
            {section.heading}
          </h2>

          <div className="pl-9 space-y-4">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed">
                {paragraph}
              </p>
            ))}

            {section.bullets && (
              <ul className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10 text-fg-soft">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 mr-3 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  </div>
);

export default LegalPage;
