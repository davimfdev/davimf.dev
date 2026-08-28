/**
 * Meus Pedidos — de onde o cliente pede reembolso sozinho.
 *
 * A política de reembolso manda o cliente vir para cá, então esta tela
 * precisa existir e ser alcançável (link em Minhas Chaves e no menu do
 * usuário).
 *
 * A ação de cada linha vem do STATUS primeiro, depois das datas — um botão
 * cujo único desfecho possível é 409 não deveria ser desenhado. Dentro da
 * janela de 7 dias o pedido é um reembolso de verdade: a licença é revogada,
 * e a confirmação avisa isso. Fora da janela, nada é revogado — o caso vai
 * para uma pessoa analisar — e reaproveitar o aviso de revogação ali
 * assustaria um cliente de um pedido que não custa nada. A checagem da
 * janela aqui é só apresentação; quem decide de verdade é o servidor.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import { ApiError, paymentsApi } from '../features/checkout/api';
import type { OrderSummary } from '../features/checkout/api';

type Action = 'refund' | 'review' | 'none';

type RefundOutcome = 'refunded' | 'manual' | 'reconciliation_required';

type DialogState =
  | { kind: 'refund'; order: OrderSummary }
  | { kind: 'review'; order: OrderSummary }
  | null;

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  PROCESSING: 'Processando',
  PAID: 'Pago',
  DECLINED: 'Recusado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
  REFUNDED: 'Reembolsado',
  PARTIALLY_REFUNDED: 'Parcialmente reembolsado',
  CHARGEBACK: 'Contestado',
};

const OUTCOME_MESSAGE: Record<RefundOutcome, string> = {
  refunded: 'Reembolso confirmado. Sua licença foi revogada.',
  manual: 'Solicitação enviada para análise.',
  reconciliation_required: 'Solicitação recebida; estamos conciliando o pagamento.',
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);

function reasonForNone(status: string): string {
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'Este pedido já foi reembolsado.';
  if (status === 'CHARGEBACK') return 'Há uma contestação em análise. Fale com financeiro@davimf.dev.';
  return 'Aguardando confirmação do pagamento.';
}

function actionFor(order: OrderSummary): Action {
  // Um botão cujo único desfecho possível é 409 não deveria ser desenhado.
  if (order.status !== 'PAID') return 'none';
  const delivered = [order.paidAt, order.fulfilledAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (delivered.length === 0) return 'review';
  const days = (Date.now() - Math.max(...delivered)) / 86_400_000;
  return days <= 7 ? 'refund' : 'review';
}

const MyOrders = () => {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [outcomeByOrder, setOutcomeByOrder] = useState<Record<string, RefundOutcome>>({});

  useEffect(() => {
    let active = true;

    paymentsApi.orders()
      .then((data) => {
        if (!active) return;
        setOrders(data.orders);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiError && caught.status === 401
            ? 'Faça login com Discord para ver seus pedidos.'
            : 'Não foi possível carregar seus pedidos.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openDialog = (kind: 'refund' | 'review', order: OrderSummary) => {
    setDialog({ kind, order });
    setDescription('');
    setDialogError(null);
  };

  const closeDialog = () => {
    if (submitting) return;
    setDialog(null);
    setDescription('');
    setDialogError(null);
  };

  const submitRefundRequest = async (orderId: string, requestDescription?: string) => {
    setSubmitting(true);
    setDialogError(null);
    try {
      const result = requestDescription
        ? await paymentsApi.refundRequest(orderId, requestDescription)
        : await paymentsApi.refundRequest(orderId);
      setOutcomeByOrder((current) => ({ ...current, [orderId]: result.outcome }));
      setDialog(null);
      setDescription('');
    } catch (caught) {
      setDialogError(
        caught instanceof ApiError ? caught.message : 'Não foi possível enviar sua solicitação. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRefund = () => {
    if (!dialog || dialog.kind !== 'refund') return;
    void submitRefundRequest(dialog.order.id);
  };

  const confirmReview = () => {
    if (!dialog || dialog.kind !== 'review') return;
    const trimmed = description.trim();
    if (!trimmed) return;
    void submitRefundRequest(dialog.order.id, trimmed);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#A8A8A4]">Carregando seus pedidos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/" className="text-accent hover:underline">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart size={26} className="text-accent" />
        <h1 className="text-3xl font-display font-extrabold text-[#F5F3EF]">Meus Pedidos</h1>
      </div>

      {orders.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <ShoppingCart size={44} className="text-[#3A3A36] mx-auto mb-4" />
          <p className="text-[#A8A8A4]">Nenhum pedido encontrado.</p>
          <Link to="/fmm" className="mt-4 inline-block text-accent hover:underline">Ver planos</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const status = STATUS_LABEL[order.status] ?? order.status;
            const outcome = outcomeByOrder[order.id];
            const action = actionFor(order);

            return (
              <div key={order.id} className="glass-panel p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <span className="text-sm font-bold text-[#F5F3EF]">Pedido {order.reference}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-[#A8A8A4] bg-white/[0.06]">
                    {status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6B67]">
                  <span>{formatMoney(order.amountCents, order.currency)}</span>
                  <span>Comprado em {formatDate(order.createdAt)}</span>
                  {order.paidAt && <span>Pago em {formatDate(order.paidAt)}</span>}
                </div>

                <div className="mt-4">
                  {outcome ? (
                    <p className="text-sm text-[#A8A8A4]">{OUTCOME_MESSAGE[outcome]}</p>
                  ) : action === 'refund' ? (
                    <button
                      onClick={() => openDialog('refund', order)}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Solicitar reembolso
                    </button>
                  ) : action === 'review' ? (
                    <button
                      onClick={() => openDialog('review', order)}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Solicitar análise
                    </button>
                  ) : (
                    <p className="text-sm text-[#6B6B67]">{reasonForNone(order.status)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog?.kind === 'refund' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="glass-panel max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <AlertTriangle size={20} />
              <h2 className="font-display font-bold text-lg text-[#F5F3EF]">Solicitar reembolso</h2>
            </div>
            <p className="text-sm text-[#A8A8A4] mb-5">
              Confirmar reembolso? Sua licença será revogada e deixará de funcionar.
            </p>
            {dialogError && <p className="text-sm text-red-400 mb-4">{dialogError}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={closeDialog} disabled={submitting} className="btn-secondary text-sm py-2 px-4 disabled:opacity-60">
                Cancelar
              </button>
              <button onClick={confirmRefund} disabled={submitting} className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
                {submitting ? 'Enviando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog?.kind === 'review' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="glass-panel max-w-md w-full p-6">
            <h2 className="font-display font-bold text-lg text-[#F5F3EF] mb-3">Solicitar análise</h2>
            <p className="text-sm text-[#A8A8A4] mb-3">
              Conte o que aconteceu com o pedido. Um analista vai revisar sua solicitação.
            </p>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Descreva o problema…"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F5F3EF] mb-2"
            />
            {dialogError && <p className="text-sm text-red-400 mb-2">{dialogError}</p>}
            <div className="flex justify-end gap-3 mt-3">
              <button onClick={closeDialog} disabled={submitting} className="btn-secondary text-sm py-2 px-4 disabled:opacity-60">
                Cancelar
              </button>
              <button
                onClick={confirmReview}
                disabled={submitting || description.trim().length === 0}
                className="btn-primary text-sm py-2 px-4 disabled:opacity-60"
              >
                {submitting ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
