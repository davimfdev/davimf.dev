/**
 * Página dedicada de Sobre.
 *
 * É sobre o TRABALHO, não sobre a pessoa: nada de trajetória, datas ou cargo.
 * Todo conteúdo aqui ou é verificável no repositório ou foi dito pelo dono.
 *
 * A Home tem um teaser de três linhas que aponta para cá. As duas páginas não
 * podem repetir texto — foi exatamente esse o defeito que originou esta versão.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Eyebrow } from '../components/ui';
import { StackGrid } from '../features/home/StackGrid';

const About = () => {
  const { translations } = useLanguage();
  const t = translations.home;
  const build = t.about.build;

  return (
    <div className="max-w-content mx-auto py-10">
      <div className="flex items-center gap-4 mb-12">
        <Eyebrow>{t.about.heading}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <Eyebrow>{t.systemId}</Eyebrow>
      </div>

      <p className="text-display-3 font-display text-fg max-w-prose text-balance leading-tight">
        {t.about.intro}
      </p>

      <section className="mt-16">
        <div className="flex items-center gap-4 mb-8">
          <Eyebrow>{t.about.buildHeading}</Eyebrow>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <dl className="space-y-5">
          {[build.products, build.custom, build.tools].map((row) => (
            <div key={row.label} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-6">
              <dt><Eyebrow>{row.label}</Eyebrow></dt>
              <dd className="text-fg-soft">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <StackGrid />

      <Link
        to="/contact"
        className="inline-flex items-center gap-2 mt-16 text-sm text-fg hover:text-accent transition-colors duration-fast group"
      >
        {t.contact.cta}
        <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
      </Link>
    </div>
  );
};

export default About;
