// @vitest-environment jsdom
/**
 * Desafio 3DS embutido — o que este arquivo protege:
 *
 *  - a origem esperada é derivada da PRÓPRIA URL do desafio e comparada por
 *    igualdade exata: nada de `*`, `startsWith`, `includes` ou substring;
 *  - só `{ status: 'COMPLETE' }` conta como "terminei aqui";
 *  - `onComplete` significa RECONCILIAR, jamais "está pago": o status exibido
 *    é sempre o que o BACKEND devolveu, porque o conteúdo de um iframe é
 *    entrada não confiável;
 *  - URL impossível de parsear não renderiza iframe e não instala listener
 *    algum — o status volta a depender só de webhook/polling;
 *  - o listener é removido ao desmontar e ao trocar de URL;
 *  - o checkout embute o desafio em vez de navegar a página inteira, e mantém
 *    o polling de cinco segundos depois da reconciliação.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThreeDsChallenge } from '../ThreeDsChallenge';
import { CheckoutModal } from '../CheckoutModal';
import type { CatalogProduct, PaymentView } from '../api';

const { paymentsApiMock } = vi.hoisted(() => ({
  paymentsApiMock: {
    config: vi.fn(),
    products: vi.fn(),
    checkout: vi.fn(),
    pix: vi.fn(),
    boleto: vi.fn(),
    card: vi.fn(),
    status: vi.fn(),
    order: vi.fn(),
    licenses: vi.fn(),
    subscriptions: vi.fn(),
    cancelSubscription: vi.fn(),
    payerProfile: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, paymentsApi: paymentsApiMock };
});

const CHALLENGE_URL = 'https://www.mercadopago.com.br/3ds/challenge/abc123?token=opaque';
const CHALLENGE_ORIGIN = 'https://www.mercadopago.com.br';

function postMessage(origin: string, data: unknown): void {
  fireEvent(window, new MessageEvent('message', { origin, data }));
}

// ------------------------------------------------------------ componente ---

describe('ThreeDsChallenge', () => {
  afterEach(cleanup);

  function renderChallenge(url = CHALLENGE_URL) {
    const onComplete = vi.fn();
    const onInvalidUrl = vi.fn();
    const view = render(<ThreeDsChallenge url={url} onComplete={onComplete} onInvalidUrl={onInvalidUrl} />);
    return { ...view, onComplete, onInvalidUrl };
  }

  it('aceita COMPLETE apenas da origem exata derivada da URL', () => {
    const { onComplete } = renderChallenge();

    postMessage('https://evil.example', { status: 'COMPLETE' });
    expect(onComplete).not.toHaveBeenCalled();

    postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('recusa origens que apenas PARECEM a esperada', () => {
    const { onComplete } = renderChallenge();

    // Cada uma passa em algum teste frouxo: prefixo, sufixo, substring, porta
    // diferente, protocolo diferente.
    for (const origin of [
      'https://www.mercadopago.com.br.evil.example',
      'https://evil.example/https://www.mercadopago.com.br',
      'https://mercadopago.com.br',
      'https://www.mercadopago.com.br:8443',
      'http://www.mercadopago.com.br',
      'https://WWW.MERCADOPAGO.COM.BR',
      'null',
      '*',
      '',
    ]) {
      postMessage(origin, { status: 'COMPLETE' });
    }

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('só reage a COMPLETE — nenhum outro conteúdo de mensagem serve', () => {
    const { onComplete } = renderChallenge();

    postMessage(CHALLENGE_ORIGIN, { status: 'PENDING' });
    postMessage(CHALLENGE_ORIGIN, { status: 'complete' });
    postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETED' });
    postMessage(CHALLENGE_ORIGIN, 'COMPLETE');
    postMessage(CHALLENGE_ORIGIN, null);
    postMessage(CHALLENGE_ORIGIN, { paid: true });
    expect(onComplete).not.toHaveBeenCalled();

    postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renderiza o iframe com título e allow restrito à origem do desafio', () => {
    const { container } = renderChallenge();

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toBe(CHALLENGE_URL);
    expect(iframe.getAttribute('title')).toBeTruthy();
    expect(screen.getByTitle(iframe.getAttribute('title') as string)).toBe(iframe);

    const allow = iframe.getAttribute('allow') as string;
    // Suficiente para autenticação de pagamento (payment + WebAuthn) e
    // delegado SÓ para a origem do desafio: nada de `*`.
    expect(allow).toContain('payment');
    expect(allow).toContain('publickey-credentials-get');
    expect(allow).toContain(CHALLENGE_ORIGIN);
    expect(allow).not.toContain('*');
  });

  it('URL impossível de parsear: nenhum iframe e nenhum listener instalado', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const { container, onComplete, onInvalidUrl } = renderChallenge('não é uma url');

    expect(container.querySelector('iframe')).toBeNull();
    expect(onInvalidUrl).toHaveBeenCalledTimes(1);
    expect(addEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(0);

    // Sem origem estável não existe comparação possível: nada é aceito.
    postMessage('https://evil.example', { status: 'COMPLETE' });
    postMessage('null', { status: 'COMPLETE' });
    expect(onComplete).not.toHaveBeenCalled();

    addEventListener.mockRestore();
  });

  it('URL sem origem confiável (opaca) também cai no fallback de webhook/polling', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const { container, onComplete, onInvalidUrl } = renderChallenge('javascript:top.postMessage({status:"COMPLETE"})');

    expect(container.querySelector('iframe')).toBeNull();
    expect(onInvalidUrl).toHaveBeenCalledTimes(1);
    expect(addEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(0);
    postMessage('null', { status: 'COMPLETE' });
    expect(onComplete).not.toHaveBeenCalled();

    addEventListener.mockRestore();
  });

  it('remove o listener ao desmontar', () => {
    const { onComplete, unmount } = renderChallenge();

    unmount();
    postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('troca de URL move a origem aceita junto — a antiga deixa de valer', () => {
    const onComplete = vi.fn();
    const onInvalidUrl = vi.fn();
    const { rerender } = render(
      <ThreeDsChallenge url={CHALLENGE_URL} onComplete={onComplete} onInvalidUrl={onInvalidUrl} />,
    );

    rerender(
      <ThreeDsChallenge
        url="https://auth.emissor.example/3ds/step-up"
        onComplete={onComplete}
        onInvalidUrl={onInvalidUrl}
      />,
    );

    postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    expect(onComplete).not.toHaveBeenCalled();

    postMessage('https://auth.emissor.example', { status: 'COMPLETE' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// -------------------------------------------------------- integração ------

const PRODUCT: CatalogProduct = {
  code: 'fmm-pro-monthly',
  family: 'fmm',
  name: 'FMM Pro',
  description: null,
  priceCents: 3500,
  currency: 'BRL',
  isLifetime: false,
  recurringEligible: false,
  recurringInterval: null,
  recurringFrequency: null,
  durationDays: 30,
};

const CHALLENGE_PAYMENT: PaymentView = {
  id: 'pay-3ds',
  orderId: 'order-1',
  orderReference: 'DVMF-TEST0001',
  productName: PRODUCT.name,
  method: 'card',
  status: 'PROCESSING',
  amountCents: 3500,
  currency: 'BRL',
  installments: 1,
  expiresAt: null,
  card: { brand: 'master', lastFour: '0001' },
  threeDsUrl: CHALLENGE_URL,
};

const APPROVED_PAYMENT: PaymentView = {
  ...CHALLENGE_PAYMENT,
  status: 'PAID',
  threeDsUrl: null,
  license: { key: 'FMM-AAAA-BBBB', keyPrefix: 'FMM-AAAA', expiresAt: null, status: 'ACTIVE' },
  downloadUrl: 'https://davimf.dev/fmm',
};

const DECLINED_PAYMENT: PaymentView = { ...CHALLENGE_PAYMENT, status: 'DECLINED', threeDsUrl: null };

let binChangeHandlers: Array<(payload: unknown) => void> = [];

class FakeMercadoPago {
  fields = {
    create: () => ({
      mount: () => undefined,
      unmount: () => undefined,
      on: (event: string, handler: (payload: unknown) => void) => {
        if (event === 'binChange') binChangeHandlers.push(handler);
      },
      update: () => undefined,
    }),
    createCardToken: async () => ({ id: 'tok_fake' }),
  };
  getPaymentMethods = async () => ({ results: [{ id: 'master', name: 'Mastercard', payment_type_id: 'credit_card' }] });
  getInstallments = async () => [];
  getIdentificationTypes = async () => [];
}

describe('CheckoutModal com desafio 3DS embutido', () => {
  beforeEach(() => {
    (window as unknown as { MercadoPago?: unknown }).MercadoPago = FakeMercadoPago;
    binChangeHandlers = [];
    paymentsApiMock.config.mockResolvedValue({
      provider: 'mercadopago', environment: 'sandbox', publicKey: 'TEST-pk',
      downloadUrl: 'https://davimf.dev/fmm', methods: ['pix', 'card', 'boleto'],
    });
    paymentsApiMock.checkout.mockResolvedValue({
      order: {
        id: 'order-1', reference: 'DVMF-TEST0001', status: 'PENDING', amountCents: 3500,
        currency: 'BRL', autoRenew: false, productCode: PRODUCT.code, productName: PRODUCT.name,
      },
      product: PRODUCT,
      reused: false,
    });
    paymentsApiMock.card.mockResolvedValue({ payment: CHALLENGE_PAYMENT });
    paymentsApiMock.payerProfile.get.mockResolvedValue({ persistenceAvailable: true, profile: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /** Vai do produto até o desafio 3DS renderizado. */
  async function payWithCard(): Promise<void> {
    render(
      <MemoryRouter>
        <CheckoutModal product={PRODUCT} onClose={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(paymentsApiMock.payerProfile.get).toHaveBeenCalledTimes(1));

    const values: Array<[string, string]> = [
      ['E-mail para receber a chave', 'davi@example.com'],
      ['Nome', 'Davi'],
      ['Sobrenome', 'Moraes'],
      ['Número do documento', '12345678909'],
      ['CEP', '01310100'],
      ['Rua', 'Avenida Paulista'],
      ['Número', '1000'],
      ['Bairro', 'Bela Vista'],
      ['Cidade', 'Sao Paulo'],
      ['Estado (UF)', 'SP'],
    ];
    for (const [label, value] of values) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    // Aceite dos documentos legais — sem ele o botão fica desabilitado.
    fireEvent.click(screen.getByLabelText(/Li e concordo com os/));

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Cartão/ }));

    fireEvent.change(await screen.findByLabelText('Nome impresso no cartão'), { target: { value: 'DAVI M MORAES' } });
    fireEvent.change(screen.getByLabelText('Número do documento'), { target: { value: '12345678909' } });
    await act(async () => {
      for (const handler of binChangeHandlers) handler({ bin: '503175' });
    });

    fireEvent.click(screen.getByRole('button', { name: /Pagar agora/ }));
    await waitFor(() => expect(paymentsApiMock.card).toHaveBeenCalledTimes(1));
  }

  it('embute o desafio no checkout em vez de navegar a página inteira', async () => {
    await payWithCard();

    const iframe = await waitFor(() => {
      const found = document.querySelector('iframe[src="' + CHALLENGE_URL + '"]');
      expect(found).toBeTruthy();
      return found as HTMLIFrameElement;
    });
    expect(iframe.getAttribute('title')).toBeTruthy();
    // A tela do desafio não afirma nada sobre o pagamento.
    expect(screen.queryByRole('heading', { name: 'Pagamento aprovado' })).toBeNull();
  });

  it('COMPLETE reconcilia com o backend e adota o status devolvido por ele', async () => {
    paymentsApiMock.status.mockResolvedValue({ payment: APPROVED_PAYMENT });
    await payWithCard();
    await screen.findByTitle(/autentica/i);

    await act(async () => {
      postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    });

    await waitFor(() => expect(paymentsApiMock.status).toHaveBeenCalledWith('pay-3ds'));
    expect(await screen.findByRole('heading', { name: 'Pagamento aprovado' })).toBeTruthy();
  });

  /**
   * A propriedade mais importante da tarefa: a mensagem do iframe NUNCA marca
   * pago. Aqui o backend recusa e é a recusa que aparece.
   */
  it('nunca marca como pago pela mensagem: exibe a recusa devolvida pelo backend', async () => {
    paymentsApiMock.status.mockResolvedValue({ payment: DECLINED_PAYMENT });
    await payWithCard();
    await screen.findByTitle(/autentica/i);

    await act(async () => {
      postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    });

    await waitFor(() => expect(paymentsApiMock.status).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Pagamento não aprovado' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pagamento aprovado' })).toBeNull();
  });

  it('mensagem de origem estranha não dispara reconciliação nenhuma', async () => {
    paymentsApiMock.status.mockResolvedValue({ payment: APPROVED_PAYMENT });
    await payWithCard();
    const iframe = await screen.findByTitle(/autentica/i);

    await act(async () => {
      postMessage('https://evil.example', { status: 'COMPLETE' });
      postMessage('https://www.mercadopago.com.br.evil.example', { status: 'COMPLETE' });
    });

    expect(paymentsApiMock.status).not.toHaveBeenCalled();
    // O desafio continua na tela; nada foi decidido.
    expect(iframe.isConnected).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Pagamento aprovado' })).toBeNull();
  });

  /**
   * Se a reconciliação ainda vier com a URL do desafio, ela NÃO reabre o
   * iframe: o desafio já foi concluído uma vez e reabri-lo daria um laço. A
   * tela explica que a autenticação está sendo confirmada e o polling segue.
   */
  it('não reabre o desafio quando a reconciliação ainda não decidiu', async () => {
    paymentsApiMock.status.mockResolvedValue({ payment: CHALLENGE_PAYMENT });
    await payWithCard();
    await screen.findByTitle(/autentica/i);

    await act(async () => {
      postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
    });

    await waitFor(() => expect(paymentsApiMock.status).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/confirmando a autenticação com o banco emissor/i)).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('mantém o polling de cinco segundos quando a reconciliação ainda não é terminal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      paymentsApiMock.status.mockResolvedValue({ payment: { ...CHALLENGE_PAYMENT, threeDsUrl: null } });
      await payWithCard();
      await screen.findByTitle(/autentica/i);

      await act(async () => {
        postMessage(CHALLENGE_ORIGIN, { status: 'COMPLETE' });
      });
      await waitFor(() => expect(paymentsApiMock.status).toHaveBeenCalledTimes(1));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(paymentsApiMock.status.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
