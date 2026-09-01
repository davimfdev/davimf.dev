/**
 * Fecho da Home.
 *
 * A narrativa termina com um convite, não com um formulário — o formulário
 * continua em /contact. Este é um dos três lugares que garantem que Contato
 * continue fácil de achar depois de sair da navbar.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Reveal } from './Reveal';

export function ContactClose() {
  const { translations } = useLanguage();
  const t = translations.home.contact;

  return (
    <section className="py-section border-t border-line">
      <Reveal>
        <p className="text-fg-muted">{t.question}</p>
        <p className="text-display-2 font-display font-bold text-fg mt-3 text-balance">
          {t.invite}
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 mt-8 md:mt-10 text-sm text-fg hover:text-accent transition-colors duration-fast group"
        >
          {t.cta}
          <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}
