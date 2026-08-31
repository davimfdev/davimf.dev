/**
 * Momento de About na Home: três linhas e um link.
 *
 * A bio completa vive em /about. A narrativa da Home precisa desta respirada
 * entre os produtos e o fecho, mas não precisa da biografia inteira.
 *
 * Bloco puramente tipográfico: sem card, sem foto.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Reveal } from './Reveal';
import { SectionHeading } from './SectionHeading';

export function AboutTeaser() {
  const { translations } = useLanguage();
  const t = translations.home.about;

  return (
    <section className="py-section">
      <SectionHeading label={t.heading} id="about" />
      <Reveal>
        <p className="text-display-4 text-fg-soft max-w-prose leading-snug">{t.teaser}</p>
        <Link
          to="/about"
          className="inline-flex items-center gap-2 mt-8 text-sm text-fg hover:text-accent transition-colors duration-fast group"
        >
          {t.link}
          <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}
