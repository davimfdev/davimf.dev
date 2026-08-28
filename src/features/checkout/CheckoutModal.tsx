/**
 * Checkout transparente — acontece DENTRO do site.
 *
 * Fluxo: Produto -> Identificação -> Pix/Cartão/Boleto -> Resultado.
 * Nem a autenticação bancária obrigatória (3DS) tira o usuário do site: ela é
 * embutida em `ThreeDsChallenge` e a mensagem de conclusão dela só manda
 * RECONCILIAR com o backend — quem diz se está pago é o provider.
 *
 * A etapa de identificação coleta os dados do pagador exigidos pela transação
 * ANTES da escolha do método. Eles são enviados em toda cobrança; guardá-los
 * para a próxima compra depende de consentimento explícito e desmarcado por
 * padrão. Dados de cartão continuam exclusivamente nos Secure Fields.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, Loader2, QrCode, RefreshCw, X } from 'lucide-react';
import {
  ApiError,
  formatMoney,
  paymentsApi,
  type CatalogProduct,
  type CheckoutOrder,
  type PaymentView,
} from './api';
import { CardForm, type CardSubmitPayload } from './CardForm';
import {
  PayerProfileForm,
  emptyPayerProfileValues,
  payerProfileValuesFrom,
  toPayerInput,
  toPayerProfile,
  type PayerProfileFormValues,
} from './PayerProfileForm';
import { PaymentResult } from './PaymentResult';
import { ThreeDsChallenge } from './ThreeDsChallenge';
import { useMercadoPago } from './useMercadoPago';
import { readMercadoPagoDeviceId, useMercadoPagoDeviceId } from './useMercadoPagoDeviceId';

type Method = 'pix' | 'card' | 'boleto';
type Step = 'identify' | 'method' | 'result';

const METHODS: Array<{ id: Method; label: string; Icon: typeof QrCode; hint: string }> = [
  { id: 'pix', label: 'Pix', Icon: QrCode, hint: 'Liberação imediata' },
  { id: 'card', label: 'Cartão', Icon: CreditCard, hint: 'Aprovação na hora' },
  { id: 'boleto', label: 'Boleto', Icon: Banknote, hint: 'Até 3 dias úteis' },
];

/** Estados terminais param o polling. */
const SETTLED = new Set(['PAID', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK']);

type Props = {
  product: CatalogProduct;
  onClose: () => void;
};

export function CheckoutModal({ product, onClose }: Props) {
  const [step, setStep] = useState<Step>('identify');
  const [method, setMethod] = useState<Method>('pix');
  const [autoRenew, setAutoRenew] = useState(false);

  const [payerValues, setPayerValues] = useState<PayerProfileFormValues>(emptyPayerProfileValues);
  // Vira `true` no primeiro caractere digitado: o pré-preenchimento tardio do
  // perfil salvo não pode sobrescrever o que já está sendo escrito.
  const payerTouched = useRef(false);
  // Consentimento NASCE desmarcado — inclusive quando o formulário veio
  // pré-preenchido por um perfil salvo.
  const [saveProfile, setSaveProfile] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [profilePersistence, setProfilePersistence] = useState(false);

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  // URL do desafio 3DS em exibição. Existe só enquanto o emissor precisa da
  // confirmação extra; some assim que o desafio termina ou se revela inválido.
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chave estável por montagem do modal: refresh e duplo clique reaproveitam o
  // MESMO pedido/cobrança em vez de criar outro.
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
  );

  // O SDK é carregado assim que a public key chega: é ele quem gera o Device
  // ID, útil para Pix e boleto também — não só para o formulário de cartão.
  const { mp, loading: sdkLoading, error: sdkError } = useMercadoPago(publicKey);
  // Leitura defensiva e limitada. `null` é um resultado aceitável: nada no
  // checkout espera pelo Device ID.
  const deviceId = useMercadoPagoDeviceId(Boolean(mp), { attempts: 8, intervalMs: 125 });

  const recurringAvailable = product.recurringEligible && !product.isLifetime;
  const email = payerValues.email;

  useEffect(() => {
    paymentsApi.config().then((config) => setPublicKey(config.publicKey)).catch(() => setPublicKey(null));
  }, []);

  // Perfil salvo: pré-preenche e habilita a exclusão. Falha ou indisponível
  // degrada só o perfil — pagar continua funcionando.
  useEffect(() => {
    let cancelled = false;
    paymentsApi.payerProfile
      .get()
      .then(({ persistenceAvailable, profile }) => {
        if (cancelled) return;
        setProfilePersistence(persistenceAvailable);
        if (profile) {
          setHasSavedProfile(true);
          // O GET pode resolver DEPOIS que o usuário já começou a digitar.
          // Pré-preencher aí apagaria o que ele escreveu: só formulário
          // intocado aceita o perfil salvo.
          if (!payerTouched.current) setPayerValues(payerProfileValuesFrom(profile));
        }
      })
      .catch(() => {
        if (!cancelled) setProfilePersistence(false);
      });
    return () => {
      cancelled = true;
    };
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

  const payer = useMemo(() => toPayerInput(payerValues, email.trim().toLowerCase()), [payerValues, email]);

  /** Tudo que acompanha QUALQUER cobrança, além do pedido. */
  const chargeExtras = () => {
    // O perfil guardado é SEMPRE o que o usuário revisou aqui — nunca um
    // documento substituído mais adiante pela transação (o do portador do
    // cartão). Só viaja com o consentimento dado.
    const reviewedProfile = saveProfile ? toPayerProfile(payerValues) : null;
    // O SDK/security.js pode publicar o valor depois que a janela curta do
    // hook terminou. Uma leitura final e síncrona no clique captura esse valor
    // real sem atrasar nem impedir o pagamento quando ele continua ausente.
    const currentDeviceId = deviceId ?? readMercadoPagoDeviceId();
    return {
      payer,
      // Espelha exatamente a caixa de consentimento.
      savePayerProfile: saveProfile,
      ...(reviewedProfile ? { payerProfile: reviewedProfile } : {}),
      // Só um Device ID REAL do SDK viaja; ausente é ausente.
      ...(currentDeviceId ? { deviceId: currentDeviceId } : {}),
    };
  };

  /**
   * Fim do desafio 3DS. A mensagem do iframe significa "reconcilie agora" e
   * NUNCA "está pago": lemos o status no backend e adotamos o que ele
   * devolver. Se a leitura falhar, o polling de cinco segundos continua.
   */
  const handleChallengeComplete = useCallback(async () => {
    setChallengeUrl(null);
    const paymentId = payment?.id;
    if (!paymentId) return;
    try {
      const { payment: reconciled } = await paymentsApi.status(paymentId);
      setPayment(reconciled);
    } catch {
      /* webhook e polling continuam sendo a fonte da verdade */
    }
  }, [payment?.id]);

  /**
   * URL de desafio sem origem confiável. Não relaxamos a validação: o desafio
   * simplesmente não é exibido e o status fica por conta de webhook/polling.
   */
  const handleChallengeInvalidUrl = useCallback(() => {
    setChallengeUrl(null);
  }, []);

  const handleDeleteProfile = async () => {
    try {
      await paymentsApi.payerProfile.delete();
      setHasSavedProfile(false);
      setSaveProfile(false);
      setError(null);
    } catch (caught) {
      setError(describeError(caught));
    }
  };

  const handleIdentify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Informe um e-mail válido.');
    // Salvar exige o perfil COMPLETO — é o que o backend armazena.
    if (saveProfile && !toPayerProfile(payerValues)) {
      return setError('Para salvar seus dados, preencha nome, documento e endereço completos.');
    }
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
        // A autenticação obrigatória do emissor acontece DENTRO do checkout.
        setChallengeUrl(result.threeDsUrl ?? null);
      }
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePix = () =>
    runCharge(async (orderId) => {
      const { payment: created } = await paymentsApi.pix({
        orderId,
        ...chargeExtras(),
        idempotencyKey: `${idempotencyKey.current}:pix`,
      });
      return created;
    });

  const handleBoleto = () => {
    // O boleto do provider exige pagador completo.
    if (!payer.identification) return setError('Boleto exige CPF ou CNPJ.');
    if (!payer.firstName || !payer.lastName) return setError('Boleto exige nome e sobrenome.');
    if (!payer.address) return setError('Boleto exige CEP, rua, número, bairro, cidade e UF.');
    return runCharge(async (orderId) => {
      const { payment: created } = await paymentsApi.boleto({
        orderId,
        ...chargeExtras(),
        idempotencyKey: `${idempotencyKey.current}:boleto`,
      });
      return created;
    });
  };

  const handleCard = (payload: CardSubmitPayload) =>
    runCharge(async (orderId) => {
      const extras = chargeExtras();
      const response = await paymentsApi.card({
        orderId,
        ...extras,
        payer: {
          ...extras.payer,
          // O documento do PORTADOR do cartão é o que o emissor valida. A
          // substituição para aqui: `payerProfile`, quando existe, continua
          // levando a identificação que o usuário revisou.
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
            <PayerProfileForm
              values={payerValues}
              onChange={(patch) => {
                payerTouched.current = true;
                setPayerValues((current) => ({ ...current, ...patch }));
              }}
              saveProfile={saveProfile}
              onSaveProfileChange={setSaveProfile}
              hasSavedProfile={hasSavedProfile}
              persistenceAvailable={profilePersistence}
              onDeleteSavedProfile={handleDeleteProfile}
            />

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
                <p className="text-sm text-[#A8A8A4]">
                  O boleto usa os dados informados na identificação. A compensação leva até 3 dias úteis.
                </p>
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

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">{error}</p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ resultado -- */}
        {step === 'result' && payment && (
          challengeUrl ? (
            <ThreeDsChallenge
              url={challengeUrl}
              onComplete={handleChallengeComplete}
              onInvalidUrl={handleChallengeInvalidUrl}
            />
          ) : (
            <PaymentResult payment={payment} />
          )
        )}
      </div>
    </div>
  );
}
