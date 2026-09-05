/**
 * Carrega o MercadoPago.js v2 e expõe a instância.
 *
 * A tokenização acontece INTEIRAMENTE aqui, no navegador, dentro dos iframes
 * do Mercado Pago (Secure Fields). Nem o número do cartão nem o CVV tocam o
 * nosso React state, nossa rede ou nosso backend - só o token resultante.
 */

import { useEffect, useState } from 'react';

const SDK_SRC = 'https://sdk.mercadopago.com/js/v2';
const SDK_ID = 'mercadopago-sdk-v2';

export type MpSecureField = {
  /** ID do elemento (`'mp-card-number'`), NÃO um seletor CSS (`'#...'`). */
  mount: (elementId: string) => void;
  unmount: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
  update: (options: Record<string, unknown>) => void;
};

export type MpInstallmentOption = {
  installments: number;
  recommended_message: string;
  total_amount: number;
};

export type MercadoPagoInstance = {
  fields: {
    create: (type: 'cardNumber' | 'expirationDate' | 'securityCode', options?: Record<string, unknown>) => MpSecureField;
    createCardToken: (data: {
      cardholderName: string;
      identificationType?: string;
      identificationNumber?: string;
    }) => Promise<{ id: string }>;
  };
  getPaymentMethods: (filters: { bin: string }) => Promise<{
    results: Array<{ id: string; name: string; payment_type_id: string; issuer?: { id: number } }>;
  }>;
  getInstallments: (filters: { amount: string; bin: string; paymentTypeId?: string }) => Promise<
    Array<{ payer_costs: MpInstallmentOption[] }>
  >;
  getIdentificationTypes: () => Promise<Array<{ id: string; name: string }>>;
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
    /**
     * Device ID gerado pelo próprio MercadoPago.js V2. É lido de forma
     * defensiva por `useMercadoPagoDeviceId` e viaja só com a cobrança:
     * nunca é persistido, nunca é logado, nunca é inventado por nós.
     */
    MP_DEVICE_SESSION_ID?: string;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.id = SDK_ID;
      script.src = SDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Permite nova tentativa numa próxima montagem do checkout.
      sdkPromise = null;
      reject(new Error('Não foi possível carregar o checkout seguro.'));
    });
    if (existing && window.MercadoPago) resolve();
  });

  return sdkPromise;
}

export type MercadoPagoState = {
  mp: MercadoPagoInstance | null;
  loading: boolean;
  error: string | null;
};

export function useMercadoPago(publicKey: string | null): MercadoPagoState {
  const [state, setState] = useState<MercadoPagoState>({ mp: null, loading: Boolean(publicKey), error: null });

  useEffect(() => {
    if (!publicKey) {
      setState({ mp: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ mp: null, loading: true, error: null });

    loadSdk()
      .then(() => {
        if (cancelled) return;
        if (!window.MercadoPago) throw new Error('SDK indisponível.');
        setState({ mp: new window.MercadoPago(publicKey, { locale: 'pt-BR' }), loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ mp: null, loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return state;
}
