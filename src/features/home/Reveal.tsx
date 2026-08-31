/**
 * Revelação no scroll, uma vez só.
 *
 * O deslocamento é de 8px, não 40: deslocamento grande é o que faz uma página
 * parecer landing page. Aqui o movimento existe para dizer "isto acabou de
 * entrar no campo de visão", não para chamar atenção.
 *
 * Quem pediu movimento reduzido recebe o conteúdo já assentado — sem animação
 * e sem espera.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(PREFERS_REDUCED);

  useEffect(() => {
    if (PREFERS_REDUCED) return;
    const node = ref.current;
    // Sem IntersectionObserver (jsdom, navegador antigo) o conteúdo aparece:
    // um degradê que esconde conteúdo é pior que um sem animação.
    if (!node || typeof IntersectionObserver !== 'function') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="transition-all ease-out-token"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(8px)',
        transitionDuration: PREFERS_REDUCED ? '0ms' : '420ms',
        transitionDelay: shown && !PREFERS_REDUCED ? `${delay}ms` : '0ms',
      }}
    >
      {children}
    </div>
  );
}
