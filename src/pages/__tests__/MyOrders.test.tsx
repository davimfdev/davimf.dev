// @vitest-environment jsdom
/**
 * O que este arquivo protege:
 *  - dentro da janela de 7 dias o botão é "Solicitar reembolso" e sua
 *    confirmação avisa, de forma explícita, que a licença será revogada;
 *  - fora da janela o botão é "Solicitar análise" — um pedido diferente, que
 *    NUNCA deve mencionar revogação (nada é revogado, o caso vai para uma
 *    pessoa analisar) nem reaproveitar o diálogo de reembolso;
 *  - a API só é chamada depois da confirmação, nunca ao simples clique;
 *  - quando nenhuma ação se aplica (pedido já reembolsado, por exemplo),
 *    nenhum botão é desenhado — só o motivo, como texto.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyOrders from '../MyOrders';
import { LanguageProvider } from '../../context/LanguageContext';
import { paymentsApi } from '../../features/checkout/api';

vi.mock('../../features/checkout/api', () => ({
  paymentsApi: { orders: vi.fn(), refundRequest: vi.fn() },
}));

const RECENT = { id: 'ord-1', reference: 'DVMF-1', productName: 'FMM Pro', amountCents: 20000,
  currency: 'BRL', status: 'PAID', createdAt: '2026-08-27T12:00:00.000Z', paidAt: '2026-08-27T12:00:00.000Z' };
const OLD = { ...RECENT, id: 'ord-2', reference: 'DVMF-2', paidAt: '2026-07-01T12:00:00.000Z' };
const REFUNDED = { ...RECENT, id: 'ord-3', reference: 'DVMF-3', status: 'REFUNDED' };

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
});
