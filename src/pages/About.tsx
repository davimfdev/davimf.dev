/**
 * Página dedicada de Sobre.
 *
 * Existe porque a navbar aponta para "Sobre" — sem ela o item levaria a lugar
 * nenhum. Fica deliberadamente curta: a bio completa não é o produto.
 *
 * A Stack não se repete aqui; ela vive na Home.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Eyebrow } from '../components/ui';

const About = () => {
  const { translations } = useLanguage();
  const t = translations.home;

  return (
    <div className="max-w-content mx-auto py-10">
      <div className="flex items-center gap-4 mb-12">
        <Eyebrow>{t.about.heading}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <Eyebrow>{t.systemId}</Eyebrow>
      </div>

      <p className="text-display-3 font-display text-fg max-w-prose text-balance leading-tight">
        {t.about.teaser}
      </p>

      <p className="mt-8 text-fg-soft max-w-prose leading-relaxed">{t.sub}</p>

      <Link
        to="/contact"
        className="inline-flex items-center gap-2 mt-12 text-sm text-fg hover:text-accent transition-colors duration-fast group"
      >
        {t.contact.cta}
        <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
      </Link>
    </div>
  );
};

export default About;
