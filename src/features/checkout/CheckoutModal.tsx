/**
 * Checkout transparente — acontece DENTRO do site.
 *
 * Fluxo: Produto -> Comprar -> Pix/Cartão/Boleto -> Processamento -> Resultado.
 * O único redirecionamento aceito é uma autenticação bancária obrigatória (3DS),
 * exigida pelo emissor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, Loader2, QrCode, RefreshCw, X } from 'lucide-react';
import {
  ApiError,
  formatMoney,
  paymentsApi,
  type CatalogProduct,
  type CheckoutOrder,
  type PayerInput,
  type PaymentView,
} from './api';
import { CardForm, type CardSubmitPayload } from './CardForm';
import { PaymentResult } from './PaymentResult';
import { useMercadoPago } from './useMercadoPago';

type Method = 'pix' | 'card' | 'boleto';
type Step = 'identify' | 'method' | 'result';

const METHODS: Array<{ id: Method; label: string; Icon: typeof QrCode; hint: string }> = [
  { id: 'pix', label: 'Pix', Icon: QrCode, hint: 'Liberação imediata' },
  { id: 'card', label: 'Cartão', Icon: CreditCard, hint: 'Aprovação na hora' },
  { id: 'boleto', label: 'Boleto', Icon: Banknote, hint: 'Até 3 dias úteis' },
];

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 text-[15px] text-[#F5F3EF] placeholder:text-[#6B6B67] focus:outline-none focus:border-accent/60 transition-colors';
const labelClass = 'block text-xs font-medium text-[#A8A8A4] mb-1.5';

/** Estados terminais param o polling. */
const SETTLED = new Set(['PAID', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK']);

type Props = {
  product: CatalogProduct;
  onClose: () => void;
};

export function CheckoutModal({ product, onClose }: Props) {
  const [step, setStep] = useState<Step>('identify');
  const [method, setMethod] = useState<Method>('pix');
  const [email, setEmail] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);

  const [documentNumber, setDocumentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chave estável por montagem do modal: refresh e duplo clique reaproveitam o
  // MESMO pedido/cobrança em vez de criar outro.
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
  );

  const { mp, loading: sdkLoading, error: sdkError } = useMercadoPago(step === 'method' && method === 'card' ? publicKey : null);

  const recurringAvailable = product.recurringEligible && !product.isLifetime;

  useEffect(() => {
    paymentsApi.config().then((config) => setPublicKey(config.publicKey)).catch(() => setPublicKey(null));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Polling de UX. A confirmação real é do backend/webhook — aqui só relemos.
  useEffect(() => {
    if (step !== 'result' || !payment || SETTLED.has(payment.status)) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > 120) return clearInterval(interval); // ~10 min
      try {
        const { payment: fresh } = await paymentsApi.status(payment.id);
        setPayment(fresh);
        if (SETTLED.has(fresh.status)) clearInterval(interval);
      } catch {
        /* rede instável não deve derrubar a tela do pedido */
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [step, payment]);

  const describeError = (caught: unknown): string => {
    if (caught instanceof ApiError) {
      if (caught.status === 401) return 'Faça login para concluir a compra.';
      return caught.message;
    }
    return 'Não foi possível concluir. Tente novamente.';
  };

  const ensureOrder = useCallback(async (): Promise<CheckoutOrder> => {
    if (order) return order;
    const { order: created } = await paymentsApi.checkout({
      productCode: product.code,
      email,
      quantity: 1,
      autoRenew: autoRenew && recurringAvailable,
      idempotencyKey: idempotencyKey.current,
    });
    setOrder(created);
    return created;
  }, [order, product.code, email, autoRenew, recurringAvailable]);

  const payer = useMemo((): PayerInput => {
    const digits = documentNumber.replace(/\D/g, '');
    return {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      identification: digits ? { type: digits.length > 11 ? 'CNPJ' : 'CPF', number: digits } : undefined,
      address: zipCode
        ? {
            zipCode: zipCode.replace(/\D/g, ''),
            streetName,
            streetNumber,
          }
        : undefined,
    };
  }, [email, firstName, lastName, documentNumber, zipCode, streetName, streetNumber]);

  const handleIdentify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError('Informe um e-mail válido.');
    setError(null);
    setSubmitting(true);
    try {
      await ensureOrder();
      setStep('method');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const runCharge = async (run: (orderId: string) => Promise<PaymentView | null>) => {
    setSubmitting(true);
    setError(null);
    try {
      const current = await ensureOrder();
      const result = await run(current.id);
      if (result) {
        setPayment(result);
        setStep('result');
        // Exceção permitida: autenticação bancária obrigatória (3DS).
        if (result.threeDsUrl) window.location.href = result.threeDsUrl;
      }
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePix = () =>
    runCharge(async (orderId) => {
      const { payment: created } = await paymentsApi.pix({ orderId, payer, idempotencyKey: `${idempotencyKey.current}:pix` });
      return created;
    });

  const handleBoleto = () => {
    const digits = documentNumber.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) return setError('Boleto exige CPF ou CNPJ.');
    if (!firstName.trim() || !lastName.trim()) return setError('Boleto exige nome e sobrenome.');
    if (zipCode.replace(/\D/g, '').length !== 8 || !streetName.trim() || !streetNumber.trim()) {
      return setError('Boleto exige CEP, rua e número.');
    }
    return runCharge(async (orderId) => {
      const { payment: created } = await paymentsApi.boleto({ orderId, payer, idempotencyKey: `${idempotencyKey.current}:boleto` });
      return created;
    });
  };

  const handleCard = (payload: CardSubmitPayload) =>
    runCharge(async (orderId) => {
      const response = await paymentsApi.card({
        orderId,
        payer: {
          ...payer,
          identification: { type: payload.documentType, number: payload.documentNumber },
        },
        // Só a referência segura viaja: token de uso único + id da bandeira.
        cardToken: payload.cardToken,
        paymentMethodId: payload.paymentMethodId,
        installments: payload.installments,
        idempotencyKey: `${idempotencyKey.current}:card`,
      });
      return response.payment;
    });

  const price = formatMoney(product.priceCents, product.currency);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Comprar ${product.name}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass-panel bg-[#121211] w-full max-w-md my-auto p-6 sm:p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#6B6B67] hover:text-[#F5F3EF] transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="mb-6 pr-8">
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-accent mb-1">Checkout</p>
          <h2 className="text-xl font-display font-bold text-[#F5F3EF]">{product.name}</h2>
          <p className="text-sm text-[#A8A8A4] mt-0.5">
            {price}
            {product.isLifetime ? ' · pagamento único' : product.durationDays ? ` · ${product.durationDays} dias` : ''}
          </p>
        </div>

        {/* ------------------------------------------------- identificação -- */}
        {step === 'identify' && (
          <form onSubmit={handleIdentify} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="checkout-email">E-mail para receber a chave</label>
              <input
                id="checkout-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className={inputClass}
                placeholder="voce@exemplo.com"
                required
              />
            </div>

            {recurringAvailable && (
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-white/10 px-3.5 py-3 hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(event) => setAutoRenew(event.target.checked)}
                  className="mt-0.5 accent-[#E6B566]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[#F5F3EF]">
                    <RefreshCw size={13} className="text-accent" /> Renovar automaticamente
                  </span>
                  <span className="block text-xs text-[#6B6B67] mt-0.5">
                    Cobrança recorrente no cartão. Cancele quando quiser — sua licença não é apagada.
                  </span>
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
              {submitting ? <><Loader2 size={16} className="animate-spin mr-2" /> Criando pedido…</> : 'Continuar'}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------- métodos -- */}
        {step === 'method' && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {METHODS.map(({ id, label, Icon, hint }) => {
                // Assinatura só existe no cartão.
                const disabled = order?.autoRenew === true && id !== 'card';
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => { setMethod(id); setError(null); }}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-all ${
                      method === id
                        ? 'border-accent/60 bg-accent/[0.08] text-[#F5F3EF]'
                        : 'border-white/10 text-[#A8A8A4] hover:border-white/25'
                    } ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}
                  >
                    <Icon size={18} className={method === id ? 'text-accent' : ''} />
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-[10px] text-[#6B6B67] leading-tight text-center">{hint}</span>
                  </button>
                );
              })}
            </div>

            {method === 'pix' && (
              <div>
                <p className="text-sm text-[#A8A8A4] mb-5">
                  Você receberá um QR Code e o código Copia e Cola. A liberação da chave é automática
                  assim que o banco confirmar o pagamento.
                </p>
                <button onClick={handlePix} disabled={submitting} className="btn-primary w-full disabled:opacity-60">
                  {submitting ? <><Loader2 size={16} className="animate-spin mr-2" /> Gerando Pix…</> : <>Gerar Pix de {price}</>}
                </button>
              </div>
            )}

            {method === 'boleto' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="first-name">Nome</label>
                    <input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="last-name">Sobrenome</label>
                    <input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="boleto-doc">CPF ou CNPJ</label>
                  <input id="boleto-doc" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} inputMode="numeric" className={inputClass} placeholder="000.000.000-00" />
                </div>
                <div className="grid grid-cols-[1fr_2fr_80px] gap-3">
                  <div>
                    <label className={labelClass} htmlFor="zip">CEP</label>
                    <input id="zip" value={zipCode} onChange={(e) => setZipCode(e.target.value)} inputMode="numeric" className={inputClass} placeholder="00000-000" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="street">Rua</label>
                    <input id="street" value={streetName} onChange={(e) => setStreetName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="street-number">Nº</label>
                    <input id="street-number" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} className={inputClass} />
                  </div>
                </div>

                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                <button onClick={handleBoleto} disabled={submitting} className="btn-primary w-full disabled:opacity-60">
                  {submitting ? <><Loader2 size={16} className="animate-spin mr-2" /> Gerando boleto…</> : 'Gerar boleto'}
                </button>
              </div>
            )}

            {method === 'card' && (
              <>
                {sdkLoading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#A8A8A4]">
                    <Loader2 size={16} className="animate-spin" /> Carregando checkout seguro…
                  </div>
                )}
                {!sdkLoading && !publicKey && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    Pagamento com cartão indisponível no momento. Use Pix ou boleto.
                  </p>
                )}
                {!sdkLoading && sdkError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{sdkError}</p>
                )}
                {mp && (
                  <CardForm
                    mp={mp}
                    amountCents={product.priceCents}
                    recurring={order?.autoRenew === true}
                    submitting={submitting}
                    onSubmit={handleCard}
                  />
                )}
              </>
            )}

            {method !== 'boleto' && error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">{error}</p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ resultado -- */}
        {step === 'result' && payment && <PaymentResult payment={payment} />}
      </div>
    </div>
  );
}
