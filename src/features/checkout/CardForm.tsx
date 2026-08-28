/**
 * Formulário de cartão com Secure Fields do Mercado Pago.
 *
 * SEGURANÇA: número do cartão, validade e CVV são renderizados em iframes
 * controlados pelo Mercado Pago. Este componente NUNCA lê, guarda ou envia
 * esses valores — só recebe de volta um token de uso único.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import type { MercadoPagoInstance, MpInstallmentOption } from './useMercadoPago';

/**
 * Propriedades aceitas pelo Secure Fields (camelCase). `height: 100%` importa:
 * o SDK injeta um iframe dentro do nosso contêiner de 42px e, sem altura
 * explícita, ele fica com a altura padrão do user agent e a área clicável não
 * cobre a caixa que o usuário vê.
 */
const FIELD_STYLE = {
  color: '#F5F3EF',
  fontSize: '15px',
  fontFamily: 'Satoshi, ui-sans-serif, system-ui, sans-serif',
  placeholderColor: '#6B6B67',
  height: '100%',
  width: '100%',
};

export type CardSubmitPayload = {
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  holderName: string;
  documentType: string;
  documentNumber: string;
};

type Props = {
  mp: MercadoPagoInstance;
  amountCents: number;
  /** Assinatura cobra sempre em 1x; o parcelamento fica escondido. */
  recurring: boolean;
  submitting: boolean;
  onSubmit: (payload: CardSubmitPayload) => void;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 text-[15px] text-[#F5F3EF] placeholder:text-[#6B6B67] focus:outline-none focus:border-accent/60 transition-colors';

// `[&>iframe]` garante que o iframe do Mercado Pago ocupe a caixa inteira —
// é ele que recebe o clique e o teclado.
const fieldShellClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3.5 h-[42px] flex items-center focus-within:border-accent/60 transition-colors [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0';

const labelClass = 'block text-xs font-medium text-[#A8A8A4] mb-1.5';

export function CardForm({ mp, amountCents, recurring, submitting, onSubmit }: Props) {
  const [holderName, setHolderName] = useState('');
  const [documentType, setDocumentType] = useState('CPF');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentTypes, setDocumentTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [installmentOptions, setInstallmentOptions] = useState<MpInstallmentOption[]>([]);
  const [installments, setInstallments] = useState(1);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const binRef = useRef<string | null>(null);
  const amountRef = useRef(amountCents);
  amountRef.current = amountCents;

  /** Consulta bandeira e parcelas a partir do BIN — o SDK só entrega os 6-8
   *  primeiros dígitos, nunca o número completo. */
  const onBinChange = useCallback(
    async (bin: string | null) => {
      binRef.current = bin;
      if (!bin || bin.length < 6) {
        setPaymentMethodId(null);
        setInstallmentOptions([]);
        return;
      }
      try {
        const methods = await mp.getPaymentMethods({ bin });
        const method = methods.results?.[0];
        if (!method) {
          setPaymentMethodId(null);
          setError('Não reconhecemos essa bandeira de cartão.');
          return;
        }
        setError(null);
        setPaymentMethodId(method.id);

        if (recurring) {
          setInstallmentOptions([]);
          setInstallments(1);
          return;
        }
        const amount = (amountRef.current / 100).toFixed(2);
        const options = await mp.getInstallments({ amount, bin, paymentTypeId: 'credit_card' });
        const costs = options?.[0]?.payer_costs ?? [];
        setInstallmentOptions(costs);
        setInstallments(costs[0]?.installments ?? 1);
      } catch {
        setPaymentMethodId(null);
        setInstallmentOptions([]);
      }
    },
    [mp, recurring],
  );

  // Monta os Secure Fields uma única vez por instância do SDK.
  useEffect(() => {
    const fields = [
      mp.fields.create('cardNumber', { placeholder: '0000 0000 0000 0000', style: FIELD_STYLE }),
      mp.fields.create('expirationDate', { placeholder: 'MM/AA', style: FIELD_STYLE }),
      mp.fields.create('securityCode', { placeholder: 'CVV', style: FIELD_STYLE }),
    ];

    fields[0].on('binChange', (payload) => {
      const bin = (payload as { bin?: string })?.bin ?? null;
      void onBinChange(bin);
    });

    // Sem este listener, uma falha dentro do iframe fica invisível e o campo
    // apenas "não digita".
    for (const field of fields) {
      field.on('error', (payload) => {
        console.error('[checkout] Secure Field:', payload);
        setError('Não foi possível carregar o formulário seguro do cartão. Recarregue a página.');
      });
    }

    try {
      // `mount` recebe o ID do elemento, NÃO um seletor CSS: passar
      // '#mp-card-number' faz o SDK não encontrar o contêiner e nenhum iframe
      // é montado — a caixa aparece, mas não aceita digitação.
      fields[0].mount('mp-card-number');
      fields[1].mount('mp-card-expiration');
      fields[2].mount('mp-card-security');
      setFieldsReady(true);
    } catch (mountError) {
      console.error('[checkout] falha ao montar Secure Fields:', mountError);
      setError('Não foi possível carregar o formulário seguro. Recarregue a página.');
    }

    mp.getIdentificationTypes()
      .then((types) => setDocumentTypes(types ?? []))
      .catch(() => setDocumentTypes([{ id: 'CPF', name: 'CPF' }, { id: 'CNPJ', name: 'CNPJ' }]));

    return () => {
      for (const field of fields) {
        try {
          field.unmount();
        } catch {
          /* já desmontado */
        }
      }
    };
  }, [mp, onBinChange]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!holderName.trim()) return setError('Informe o nome como está impresso no cartão.');
    const digits = documentNumber.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) return setError('Informe um CPF ou CNPJ válido.');
    if (!paymentMethodId) return setError('Confira o número do cartão.');

    setError(null);
    try {
      // O token nasce e morre no domínio do Mercado Pago; recebemos só o id.
      const token = await mp.fields.createCardToken({
        cardholderName: holderName.trim(),
        identificationType: documentType,
        identificationNumber: digits,
      });
      if (!token?.id) throw new Error('token');

      onSubmit({
        cardToken: token.id,
        paymentMethodId,
        installments: recurring ? 1 : installments,
        holderName: holderName.trim(),
        documentType,
        documentNumber: digits,
      });
    } catch {
      setError('Não foi possível validar o cartão. Confira os dados e tente de novo.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="mp-card-number">Número do cartão</label>
        <div id="mp-card-number" className={fieldShellClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="mp-card-expiration">Validade</label>
          <div id="mp-card-expiration" className={fieldShellClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="mp-card-security">Código de segurança</label>
          <div id="mp-card-security" className={fieldShellClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="card-holder">Nome impresso no cartão</label>
        <input
          id="card-holder"
          value={holderName}
          onChange={(event) => setHolderName(event.target.value)}
          autoComplete="cc-name"
          className={inputClass}
          placeholder="COMO ESTÁ NO CARTÃO"
        />
      </div>

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div>
          <label className={labelClass} htmlFor="doc-type">Documento</label>
          <select
            id="doc-type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={inputClass}
          >
            {(documentTypes.length > 0 ? documentTypes : [{ id: 'CPF', name: 'CPF' }]).map((type) => (
              <option key={type.id} value={type.id} className="bg-[#121211]">{type.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="doc-number">Número do documento</label>
          <input
            id="doc-number"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            inputMode="numeric"
            className={inputClass}
            placeholder="000.000.000-00"
          />
        </div>
      </div>

      {!recurring && installmentOptions.length > 0 && (
        <div>
          <label className={labelClass} htmlFor="installments">Parcelamento</label>
          <select
            id="installments"
            value={installments}
            onChange={(event) => setInstallments(Number(event.target.value))}
            className={inputClass}
          >
            {installmentOptions.map((option) => (
              <option key={option.installments} value={option.installments} className="bg-[#121211]">
                {option.recommended_message}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !fieldsReady}
        className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <><Loader2 size={16} className="animate-spin mr-2" /> Processando…</>
        ) : (
          <><CreditCard size={16} className="mr-2" /> {recurring ? 'Assinar' : 'Pagar agora'}</>
        )}
      </button>

      <p className="flex items-center gap-1.5 text-[11px] text-[#6B6B67] justify-center">
        <ShieldCheck size={12} className="text-accent" />
        Os dados do cartão vão direto para o Mercado Pago. Nosso servidor não os recebe.
      </p>
    </form>
  );
}
