/**
 * Leitura DEFENSIVA do Device ID gerado pelo MercadoPago.js V2.
 *
 * O SDK publica `window.MP_DEVICE_SESSION_ID` de forma assíncrona: às vezes já
 * está lá quando o checkout monta, às vezes leva alguns milissegundos. Este
 * hook checa na hora e, se não achar, tenta de novo por um intervalo CURTO e
 * LIMITADO (padrão: 8 tentativas de 125ms = no máximo 1 segundo). Depois disso
 * ele desiste e devolve `null`.
 *
 * REGRAS INEGOCIÁVEIS:
 *  - só um valor real, string e não vazio, do SDK pode ser devolvido;
 *  - NUNCA inventar substituto (UUID, localStorage, fingerprint) - isso seria
 *    mentir ao antifraude do provider;
 *  - o Device ID é request-scoped: nunca é logado, nunca é persistido;
 *  - nenhuma ação do checkout espera por ele; a cobrança segue sem o valor.
 */

import { useEffect, useState } from 'react';

const DEFAULT_ATTEMPTS = 8;
const DEFAULT_INTERVAL_MS = 125;
const SECURITY_SCRIPT_ID = 'mercadopago-security-device-id';
const SECURITY_SCRIPT_SRC = 'https://www.mercadopago.com/v2/security.js';

export type DeviceIdOptions = {
  /** Quantas releituras depois da imediata. */
  attempts?: number;
  /** Intervalo entre releituras, em milissegundos. */
  intervalMs?: number;
};

/** Só o valor REAL do SDK: string não vazia. Qualquer outra coisa vira `null`. */
export function readMercadoPagoDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value === '' ? null : value;
}

/**
 * Fallback oficial: embora o SDK V2 deva coletar o Device ID, o relatório de
 * qualidade mostrou uma Order sem o header. O security.js publica a mesma
 * variável oficial; não geramos nem substituímos o identificador.
 */
function ensureSecurityScript(): void {
  if (typeof document === 'undefined' || document.getElementById(SECURITY_SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SECURITY_SCRIPT_ID;
  script.src = SECURITY_SCRIPT_SRC;
  script.async = true;
  script.setAttribute('view', 'checkout');
  document.head.appendChild(script);
}

export function useMercadoPagoDeviceId(active: boolean, options: DeviceIdOptions = {}): string | null {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Desligado: some com o valor e não deixa timer vivo.
    if (!active) {
      setDeviceId(null);
      return;
    }

    ensureSecurityScript();

    const immediate = readMercadoPagoDeviceId();
    setDeviceId(immediate);
    if (immediate) return;

    let remaining = Math.max(0, Math.trunc(attempts));
    if (remaining === 0 || intervalMs <= 0) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      const value = readMercadoPagoDeviceId();
      if (value) {
        setDeviceId(value);
        return;
      }
      remaining -= 1;
      // Tentativa limitada: acabou o orçamento, o checkout segue sem Device ID.
      if (remaining <= 0) return;
      timer = setTimeout(poll, intervalMs);
    };
    timer = setTimeout(poll, intervalMs);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [active, attempts, intervalMs]);

  return deviceId;
}
