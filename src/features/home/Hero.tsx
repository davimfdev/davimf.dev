/**
 * Dobra da Home.
 *
 * Duas colunas: a declaração à esquerda, o ecossistema à direita. No mobile
 * vira coluna única e o grafo perde dois nós — mas não some, porque é a
 * assinatura da página.
 *
 * Nenhuma palavra do H1 é dourada (spec §5.2): destacar uma palavra do título
 * é o gesto de landing page SaaS que o revamp abandona. O dourado da dobra
 * vive no nó central do grafo e no CTA primário.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Button, Eyebrow } from '../../components/ui';
import { EcosystemGraph } from './EcosystemGraph';
import { Reveal } from './Reveal';

export function Hero() {
  const { translations } = useLanguage();
  const t = translations.home;

  return (
    <section className="pt-10 md:pt-16">
      <div className="flex items-center gap-4 mb-12">
        <Eyebrow>{t.systemLabel}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <Eyebrow>{t.systemId}</Eyebrow>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        <div className="lg:col-span-7">
          <Reveal>
            <h1 className="text-display-1 font-display font-bold text-fg text-balance">
              {t.headline}
            </h1>
          </Reveal>

          <Reveal delay={80}>
            <p className="mt-6 text-lg text-fg-soft max-w-prose leading-relaxed">
              {t.sub}
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button as={Link} to="/products">
                {t.ctaProducts}
                <ArrowRight size={16} />
              </Button>
              <Button as={Link} to="/portfolio" variant="secondary">
                {t.ctaWork}
              </Button>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <div className="hidden md:block">
            <EcosystemGraph />
          </div>
          <div className="md:hidden max-w-[240px] mx-auto">
            <EcosystemGraph compact />
          </div>
        </div>
      </div>
    </section>
  );
}
