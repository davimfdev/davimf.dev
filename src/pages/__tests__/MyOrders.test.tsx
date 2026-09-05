// @vitest-environment jsdom
/**
 * O que este arquivo protege:
 *  - dentro da janela de 7 dias o botão é "Solicitar reembolso" e sua
 *    confirmação avisa, de forma explícita, que a licença será revogada;
 *  - fora da janela o botão é "Solicitar análise" - um pedido diferente, que
 *    NUNCA deve mencionar revogação (nada é revogado, o caso vai para uma
 *    pessoa analisar) nem reaproveitar o diálogo de reembolso;
 *  - a API só é chamada depois da confirmação, nunca ao simples clique;
 *  - quando nenhuma ação se aplica (pedido já reembolsado, por exemplo),
 *    nenhum botão é desenhado - só o motivo, como texto.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyOrders from '../MyOrders';
import { LanguageProvider } from '../../context/LanguageContext';
import { ApiError, paymentsApi } from '../../features/checkout/api';

// `ApiError` precisa ser uma classe de verdade no mock: o componente faz
// `caught instanceof ApiError` para decidir se mostra a mensagem do servidor
// ou uma mensagem genérica - sem isso o `instanceof` quebraria no teste.
vi.mock('../../features/checkout/api', () => {
  class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  }
  return {
    paymentsApi: { orders: vi.fn(), refundRequest: vi.fn() },
    ApiError,
  };
});

const RECENT = { id: 'ord-1', reference: 'DVMF-1', productName: 'FMM Pro', amountCents: 20000,
  currency: 'BRL', status: 'PAID', createdAt: '2026-08-27T12:00:00.000Z', paidAt: '2026-08-27T12:00:00.000Z',
  legalAcceptance: null };
const OLD = { ...RECENT, id: 'ord-2', reference: 'DVMF-2', paidAt: '2026-07-01T12:00:00.000Z' };
const REFUNDED = { ...RECENT, id: 'ord-3', reference: 'DVMF-3', status: 'REFUNDED' };
// Relógio dessincronizado: pagamento datado no FUTURO. O servidor manda esse
// pedido para análise humana (`decideRefund` recusa `elapsedDays < 0`), então a
// tela não pode oferecer um reembolso que ele vai recusar.
const FUTURE = {
  ...RECENT, id: 'ord-4', reference: 'DVMF-4',
  paidAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
};

function renderPage() {
  return render(
    <MemoryRouter><LanguageProvider><MyOrders /></LanguageProvider></MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Meus pedidos', () => {
  it('dentro da janela oferece "Solicitar reembolso"', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Solicitar reembolso' })).toBeTruthy();
  });

  it('fora da janela oferece "Solicitar análise", não reembolso', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [OLD] } as never);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Solicitar análise' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solicitar reembolso' })).toBeNull();
  });

  it('pagamento datado no futuro oferece "Solicitar análise", nunca reembolso', async () => {
    // S1: `days <= 7` também é verdade para `days` NEGATIVO. O cliente confirmava
    // "sua licença será revogada" e recebia "enviada para análise".
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [FUTURE] } as never);
    renderPage();

    expect(await screen.findByRole('button', { name: 'Solicitar análise' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solicitar reembolso' })).toBeNull();
  });

  it('pede confirmação avisando que a licença será revogada', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));

    expect(screen.getByText(/Sua licença será revogada e deixará de funcionar/)).toBeTruthy();
    expect(paymentsApi.refundRequest).not.toHaveBeenCalled();
  });

  it('só chama a API depois de confirmar', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    vi.mocked(paymentsApi.refundRequest).mockResolvedValue({ outcome: 'refunded' } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(paymentsApi.refundRequest).toHaveBeenCalledWith('ord-1'));
  });

  it('pedido sem ação disponível não mostra botão, só o motivo', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [REFUNDED] } as never);
    renderPage();

    await screen.findByText(/DVMF-3/);
    expect(screen.queryByRole('button', { name: 'Solicitar reembolso' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Solicitar análise' })).toBeNull();
    expect(screen.getByText(/já foi reembolsado/i)).toBeTruthy();
  });

  it('o diálogo de análise não menciona revogar a licença', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [OLD] } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar análise' }));

    expect(screen.queryByText(/revogad/i)).toBeNull();
  });

  it('depois do sucesso, a linha para de oferecer a ação e mostra o resultado', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    vi.mocked(paymentsApi.refundRequest).mockResolvedValue({ outcome: 'refunded' } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    // A mensagem de resultado aparece e o botão que dispararia um novo
    // pedido (agora sem sentido - o pedido já foi reembolsado) some.
    expect(await screen.findByText(/Reembolso confirmado/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solicitar reembolso' })).toBeNull();
  });

  it('mostra a mensagem do servidor quando a API recusa com 409', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    vi.mocked(paymentsApi.refundRequest).mockRejectedValue(
      new ApiError('REFUND_ALREADY_PROCESSED', 'Este pedido já foi reembolsado.', 409),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Este pedido já foi reembolsado.')).toBeTruthy();
  });

  it('mostra a mensagem do servidor quando a API falha com 500', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    vi.mocked(paymentsApi.refundRequest).mockRejectedValue(
      new ApiError('INTERNAL_ERROR', 'Erro interno. Tente novamente em instantes.', 500),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Erro interno. Tente novamente em instantes.')).toBeTruthy();
  });

  it('não envia a análise com descrição vazia ou só espaços', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [OLD] } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar análise' }));

    const submit = screen.getByRole('button', { name: 'Enviar' });
    expect(submit.getAttribute('disabled')).not.toBeNull();

    const textarea = screen.getByPlaceholderText('Descreva o problema…');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(submit.getAttribute('disabled')).not.toBeNull();

    fireEvent.click(submit);
    expect(paymentsApi.refundRequest).not.toHaveBeenCalled();
  });

  it('clique duplo em Confirmar dispara só uma requisição', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    // Promessa controlada manualmente: mantém o pedido "em voo" durante os
    // dois cliques, para provar que o segundo não dispara outra chamada.
    let resolveRefund: (value: { outcome: 'refunded' }) => void = () => {};
    const pending = new Promise<{ outcome: 'refunded' }>((resolve) => {
      resolveRefund = resolve;
    });
    vi.mocked(paymentsApi.refundRequest).mockReturnValue(pending as never);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar reembolso' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(paymentsApi.refundRequest).toHaveBeenCalledTimes(1);

    resolveRefund({ outcome: 'refunded' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('mostra a versão dos documentos aceita, com links para o snapshot exato', async () => {
    const withAcceptance = {
      ...RECENT,
      legalAcceptance: {
        version: '2026-08-28-v1',
        acceptedAt: '2026-08-28T12:00:00.000Z',
        termsHash: 'hash-terms',
        privacyHash: 'hash-privacy',
        refundHash: 'hash-refund',
      },
    };
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [withAcceptance] } as never);
    renderPage();

    expect(await screen.findByText(/2026-08-28-v1/)).toBeTruthy();
    const terms = screen.getByRole('link', { name: /termos de serviço/i });
    const privacy = screen.getByRole('link', { name: /política de privacidade/i });
    const refund = screen.getByRole('link', { name: /política de reembolso/i });
    expect(terms.getAttribute('href')).toBe('/legal/2026-08-28-v1/terms-of-service');
    expect(privacy.getAttribute('href')).toBe('/legal/2026-08-28-v1/privacy-policy');
    expect(refund.getAttribute('href')).toBe('/legal/2026-08-28-v1/refund-policy');
  });

  it('pedido sem aceite registrado (anterior à migração) não mostra a linha de documentos', async () => {
    vi.mocked(paymentsApi.orders).mockResolvedValue({ orders: [RECENT] } as never);
    renderPage();

    await screen.findByText(/DVMF-1/);
    expect(screen.queryByRole('link', { name: /termos de serviço/i })).toBeNull();
  });
});
