/**
 * Desafio 3DS do emissor, embutido no checkout.
 *
 * SEGURANÇA — a página dentro deste iframe é ENTRADA NÃO CONFIÁVEL:
 *
 *  - a origem esperada é derivada UMA vez da própria URL do desafio e a
 *    comparação com `event.origin` é de igualdade exata. Não existe `*`,
 *    `startsWith`, `includes` nem qualquer casamento por substring: qualquer
 *    um deles aceitaria `https://www.mercadopago.com.br.evil.example`;
 *  - `{ status: 'COMPLETE' }` significa apenas "terminei aqui". Ele manda
 *    RECONCILIAR com o backend — nunca é prova de aprovação. Quem decide o
 *    status do pagamento é o provider, via webhook ou `GET` de status;
 *  - se a URL não for parseável, ou não expuser uma origem estável e opaca
 *    (qualquer coisa fora de http/https, cujo `origin` é `"null"`), nenhum
 *    iframe é renderizado e NENHUM listener é instalado. O fluxo cai no
 *    fallback normal: webhook e polling resolvem o status sozinhos. Relaxar
 *    para um listener sem validação seria trocar essa degradação segura por
 *    um canal que qualquer página pode gritar.
 */

import { useEffect, useMemo, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';

type Props = {
  /** URL do desafio devolvida pelo provider. */
  url: string;
  /** "Terminei aqui" — o checkout deve RECONCILIAR com o backend. */
  onComplete: () => void;
  /** URL sem origem confiável: o checkout segue só com webhook/polling. */
  onInvalidUrl: () => void;
};

/**
 * Origem exata do desafio, ou `null` quando ela não existe.
 *
 * `new URL()` aceita coisas como `javascript:` e `data:`, cuja `origin` é a
 * string literal `"null"` — a mesma que um contexto opaco envia em
 * `event.origin`. Comparar com ela deixaria qualquer sandbox falar conosco,
 * então só http/https contam.
 */
function challengeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin === 'null' ? null : parsed.origin;
  } catch {
    return null;
  }
}

export function ThreeDsChallenge({ url, onComplete, onInvalidUrl }: Props) {
  const expectedOrigin = useMemo(() => challengeOrigin(url), [url]);

  // Os callbacks ficam em ref para que o listener dependa SÓ da origem: assim
  // ele é instalado uma vez por URL e removido ao desmontar ou ao trocar dela.
  const onCompleteRef = useRef(onComplete);
  const onInvalidUrlRef = useRef(onInvalidUrl);
  onCompleteRef.current = onComplete;
  onInvalidUrlRef.current = onInvalidUrl;

  useEffect(() => {
    if (!expectedOrigin) {
      onInvalidUrlRef.current();
      return;
    }

    const onMessage = (event: MessageEvent) => {
      // Igualdade exata. Nada além disso.
      if (event.origin !== expectedOrigin) return;
      const data = event.data as { status?: unknown } | null;
      if (typeof data !== 'object' || data === null) return;
      if (data.status !== 'COMPLETE') return;
      onCompleteRef.current();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [expectedOrigin]);

  // Sem origem confiável não há iframe: o status vem por webhook/polling.
  if (!expectedOrigin) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <ShieldCheck size={32} className="text-accent mx-auto mb-2" />
        <h3 className="text-lg font-display font-bold text-[#F5F3EF]">Autenticação do banco</h3>
        <p className="text-sm text-[#A8A8A4] mt-1">
          Seu emissor pediu uma confirmação extra. Conclua abaixo sem fechar esta janela.
        </p>
      </div>

      <iframe
        src={url}
        title="Autenticação 3-D Secure do banco emissor"
        // Permissões mínimas para autenticar um pagamento (incluindo chave de
        // segurança/WebAuthn), delegadas SÓ para a origem do desafio.
        allow={`payment ${expectedOrigin}; publickey-credentials-get ${expectedOrigin}`}
        referrerPolicy="strict-origin"
        className="w-full h-[420px] rounded-xl border border-white/10 bg-white"
      />
    </div>
  );
}
