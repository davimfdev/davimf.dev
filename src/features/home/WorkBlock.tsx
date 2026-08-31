/**
 * Bloco editorial de Selected Work.
 *
 * O produto é MOSTRADO, não descrito: a captura é conteúdo, e por isso carrega
 * a identidade atual do produto — inclusive o violeta do FMM. Isso não viola a
 * paleta da Home (spec §4): a moldura, os rótulos, a numeração e o link
 * permanecem neutros e dourados. Nunca dessature nem recolore a captura; uma
 * captura tratada deixa de ser prova e vira ilustração.
 *
 * O recorte é por CSS, não no arquivo: não há PIL, sharp nem ImageMagick no
 * ambiente e instalar seria dependência nova. Trocar os PNG por WebP já
 * recortados depois é drop-in — basta `scale: 1, offsetX: 0, offsetY: 0`.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Eyebrow } from '../../components/ui';
import { Reveal } from './Reveal';

export type WorkShot = {
  src: string;
  label: string;
  alt: string;
  /** Fator de ampliação: 1.9 mostra ~53% da largura original. */
  scale: number;
  /** Deslocamento em % da largura/altura do contêiner, para escolher a região. */
  offsetX: number;
  offsetY: number;
};

function Shot({ shot, className = '' }: { shot: WorkShot; className?: string }) {
  return (
    <figure className={className}>
      <div
        data-shot-frame
        className="relative overflow-hidden border border-line bg-surface-1 aspect-[16/10]"
      >
        <img
          src={shot.src}
          alt={shot.alt}
          loading="lazy"
          decoding="async"
          className="absolute max-w-none"
          style={{
            width: `${shot.scale * 100}%`,
            left: `${shot.offsetX}%`,
            top: `${shot.offsetY}%`,
          }}
        />
      </div>
      <figcaption className="mt-2">
        <Eyebrow>{shot.label}</Eyebrow>
      </figcaption>
    </figure>
  );
}

type WorkBlockProps = {
  kicker: string;
  title: string;
  description: string;
  tags: string;
  link: string;
  href: string;
  shots: WorkShot[];
  /** Inverte a ordem no desktop. Ignorado no mobile: em coluna única, espelhar não comunica nada. */
  mirrored?: boolean;
};

export function WorkBlock({ kicker, title, description, tags, link, href, shots, mirrored = false }: WorkBlockProps) {
  const [primary, secondary] = shots;

  return (
    <article className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center py-section">
      <div
        data-work-media
        className={`lg:col-span-7 ${mirrored ? 'lg:order-1' : 'lg:order-2'}`}
      >
        <Reveal>
          <Shot shot={primary} />
        </Reveal>
        {secondary && (
          <Reveal delay={120}>
            <Shot shot={secondary} className="mt-6 ml-auto w-[85%] sm:w-[72%]" />
          </Reveal>
        )}
      </div>

      <div className={`lg:col-span-5 ${mirrored ? 'lg:order-2' : 'lg:order-1'}`}>
        <Reveal>
          <Eyebrow>{kicker}</Eyebrow>
          <h2 className="text-display-2 font-display font-bold text-fg mt-4 text-balance">{title}</h2>
          <span className="block h-px w-16 bg-accent my-6" aria-hidden="true" />
          <p className="text-fg-soft leading-relaxed max-w-prose">{description}</p>
          <p className="mt-6"><Eyebrow>{tags}</Eyebrow></p>
          <Link
            to={href}
            className="inline-flex items-center gap-2 mt-8 text-sm text-fg hover:text-accent transition-colors duration-fast group"
          >
            {link}
            <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </article>
  );
}
