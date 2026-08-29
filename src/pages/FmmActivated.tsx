/**
 * Resultado da compra do FMM.
 *
 * A tela lê o PEDIDO no backend (`?order=<id>`); a chave só aparece porque o
 * backend já confirmou PAID e persistiu a licença — nunca porque o frontend
 * "achou" que o pagamento deu certo.
 *
 * `?ref=` continua aceito para não quebrar links antigos: em vez de erro seco,
 * a página diz que o pedido é anterior e aponta o caminho de Minhas Chaves.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader } from 'lucide-react';
import { ApiError, paymentsApi, type PaymentView } from '../features/checkout/api';
import { PaymentResult } from '../features/checkout/PaymentResult';

const SETTLED = new Set(['PAID', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK']);

const FmmActivated = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const legacyRef = params.get('ref');

  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError(
        legacyRef
          ? 'Este link é de um pedido antigo. Suas chaves estão em Minhas Chaves.'
          : 'Link inválido. Abra o pedido a partir de Minhas Chaves.',
      );
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const { payment: current } = await paymentsApi.order(orderId);
        if (!active) return;
        if (!current) {
          setError('Este pedido ainda não tem pagamento registrado.');
          return;
        }
        setPayment(current);
        if (SETTLED.has(current.status)) settled.current = true;
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          setError('Faça login com Discord para ver este pedido.');
        } else if (caught instanceof ApiError && caught.status === 404) {
          setError('Pedido não encontrado.');
        } else {
          setError('Não foi possível carregar o pedido. Tente recarregar a página.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    // Polling apenas de UX: a confirmação definitiva vem do backend/webhook.
    const interval = setInterval(() => {
      if (settled.current) return clearInterval(interval);
      void load();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId, legacyRef]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4">
        <div className="glass-panel p-10 max-w-md w-full text-center">
          <Loader className="text-accent mx-auto mb-4 animate-spin" size={44} />
          <h2 className="text-xl font-display font-bold text-[#F5F3EF] mb-2">Carregando pedido…</h2>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4">
        <div className="glass-panel p-10 max-w-md w-full text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={44} />
          <h2 className="text-2xl font-display font-bold text-[#F5F3EF] mb-3">Não foi possível abrir o pedido</h2>
          <p className="text-[#A8A8A4] mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/my-keys" className="btn-primary">Minhas Chaves</Link>
            <Link to="/contact" className="btn-secondary">Contato</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4 py-12">
      <div className="glass-panel bg-[#121211] p-8 sm:p-10 max-w-lg w-full">
        <PaymentResult payment={payment} />
        <p className="text-center text-sm text-[#6B6B67] mt-8">
          Dúvidas? <Link to="/contact" className="text-accent hover:underline">Entre em contato</Link>
        </p>
      </div>
    </div>
  );
};

export default FmmActivated;
