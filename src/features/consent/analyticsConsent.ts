/**
 * Consentimento para cookies de análise (LGPD).
 *
 * REGRAS INEGOCIÁVEIS:
 *  - o script do Google Analytics NÃO é carregado enquanto o estado for
 *    `unset` ou `denied`. Ele saiu do `index.html` justamente por isso: lá ele
 *    carregava antes de qualquer escolha do usuário;
 *  - recusar não pode custar funcionalidade nenhuma do site;
 *  - revogar tem de ser tão fácil quanto consentir (art. 8º, §5º), e produz
 *    efeito imediato: ligamos a flag oficial `ga-disable-<ID>`, que o próprio
 *    GA respeita mesmo com o script já carregado nesta aba.
 *
 * O estado vive em `localStorage`, por navegador. Sem ele (aba anônima,
 * armazenamento bloqueado) o estado volta a ser `unset` e o aviso reaparece —
 * que é o comportamento correto: na dúvida, não rastreia.
 */

export type ConsentState = 'unset' | 'granted' | 'denied';

export const ANALYTICS_STORAGE_KEY = 'davimf.consent.analytics';
export const GA_MEASUREMENT_ID = 'G-P30JRK5C81';

const SCRIPT_ID = 'ga-analytics-script';
const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;

type WindowWithGa = Window & {
  dataLayer?: unknown[];
  [key: string]: unknown;
};

/** Qualquer valor fora do vocabulário conhecido é tratado como `unset`. */
export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unset';
  try {
    const stored = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unset';
  } catch {
    // Armazenamento bloqueado pelo navegador: não sabemos, logo não rastreia.
    return 'unset';
  }
}

export function writeConsent(state: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, state);
  } catch {
    // Sem persistência o aviso reaparece na próxima visita. Preferível a
    // assumir consentimento que não conseguimos comprovar.
  }
}

export function analyticsLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  return document.getElementById(SCRIPT_ID) !== null;
}

function loadAnalytics(): void {
  if (typeof document === 'undefined' || analyticsLoaded()) return;

  const target = window as unknown as WindowWithGa;
  target[GA_DISABLE_FLAG] = false;
  target.dataLayer = target.dataLayer ?? [];
  function gtag(...args: unknown[]) {
    target.dataLayer?.push(args);
  }
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Ponte entre o estado e o navegador. `granted` carrega; qualquer outra coisa
 * garante que o GA fique desligado, inclusive quando o script já foi injetado
 * antes de o usuário revogar.
 */
export function applyConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  if (state === 'granted') {
    loadAnalytics();
    return;
  }
  (window as unknown as WindowWithGa)[GA_DISABLE_FLAG] = true;
}
