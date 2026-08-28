/**
 * Dados do pagador — e o perfil reutilizável opcional.
 *
 * SEGURANÇA: este formulário NUNCA toca em dado de cartão. Número, validade e
 * CVV vivem exclusivamente nos Secure Fields do Mercado Pago (`CardForm`), em
 * iframes que este componente não conhece.
 *
 * CONSENTIMENTO: a caixa "Salvar meus dados para próximas compras" nasce
 * desmarcada, inclusive quando o formulário foi pré-preenchido por um perfil
 * já salvo. Os dados da transação são enviados de qualquer jeito; a caixa
 * controla SOMENTE a persistência para compras futuras.
 */

import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { PayerAddressInput, PayerInput, PayerProfile } from './api';

export type PayerProfileFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: 'CPF' | 'CNPJ';
  documentNumber: string;
  zipCode: string;
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 text-[15px] text-[#F5F3EF] placeholder:text-[#6B6B67] focus:outline-none focus:border-accent/60 transition-colors';
const labelClass = 'block text-xs font-medium text-[#A8A8A4] mb-1.5';

export function emptyPayerProfileValues(): PayerProfileFormValues {
  return {
    firstName: '', lastName: '', email: '', phone: '', documentType: 'CPF', documentNumber: '',
    zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '', complement: '',
  };
}

/** Pré-preenchimento a partir do perfil salvo. Os campos seguem editáveis. */
export function payerProfileValuesFrom(profile: PayerProfile): PayerProfileFormValues {
  const type = profile.identification.type?.toUpperCase() === 'CNPJ' ? 'CNPJ' : 'CPF';
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    documentType: type,
    documentNumber: profile.identification.number ?? '',
    zipCode: profile.address.zipCode ?? '',
    streetName: profile.address.streetName ?? '',
    streetNumber: profile.address.streetNumber ?? '',
    neighborhood: profile.address.neighborhood ?? '',
    city: profile.address.city ?? '',
    state: profile.address.state ?? '',
    complement: profile.address.complement ?? '',
  };
}

const digitsOf = (value: string) => value.replace(/\D/g, '');

/** CPF/CNPJ só viaja com a quantidade de dígitos que o backend aceita. */
function identificationOf(values: PayerProfileFormValues): { type: string; number: string } | undefined {
  const number = digitsOf(values.documentNumber);
  if (number.length !== 11 && number.length !== 14) return undefined;
  // O tipo acompanha o número — nunca o contrário: enviar CPF com 14 dígitos
  // (ou o inverso) seria rejeitado pela validação do backend.
  return { type: number.length === 14 ? 'CNPJ' : 'CPF', number };
}

/** Endereço só viaja COMPLETO — parcial é recusado na fronteira HTTP. */
function addressOf(values: PayerProfileFormValues): PayerAddressInput | undefined {
  const zipCode = digitsOf(values.zipCode);
  const state = values.state.trim().toUpperCase();
  const streetName = values.streetName.trim();
  const streetNumber = values.streetNumber.trim();
  const neighborhood = values.neighborhood.trim();
  const city = values.city.trim();

  if (zipCode.length !== 8 || !/^[A-Z]{2}$/.test(state)) return undefined;
  if (!streetName || !streetNumber || !neighborhood || !city) return undefined;

  return {
    zipCode, streetName, streetNumber, neighborhood, city, state,
    complement: values.complement.trim() || undefined,
  };
}

function phoneOf(values: PayerProfileFormValues): string | undefined {
  const phone = digitsOf(values.phone);
  return phone.length >= 10 && phone.length <= 15 ? phone : undefined;
}

/** Dados da transação. Enviados independentemente do consentimento. */
export function toPayerInput(values: PayerProfileFormValues, fallbackEmail: string): PayerInput {
  return {
    email: values.email.trim().toLowerCase() || fallbackEmail,
    firstName: values.firstName.trim() || undefined,
    lastName: values.lastName.trim() || undefined,
    phone: phoneOf(values),
    identification: identificationOf(values),
    address: addressOf(values),
  };
}

/** Perfil só é salvável quando está completo — o backend exige tudo. */
export function toPayerProfile(values: PayerProfileFormValues): PayerProfile | null {
  const identification = identificationOf(values);
  const address = addressOf(values);
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim().toLowerCase();
  if (!identification || !address || !firstName || !lastName || !email) return null;
  return { firstName, lastName, email, phone: phoneOf(values), identification, address };
}

type Props = {
  values: PayerProfileFormValues;
  onChange: (patch: Partial<PayerProfileFormValues>) => void;
  saveProfile: boolean;
  onSaveProfileChange: (next: boolean) => void;
  /** Existe perfil salvo hoje? Só então faz sentido oferecer a exclusão. */
  hasSavedProfile: boolean;
  /** Falso quando o backend não consegue guardar perfil: pagar segue normal. */
  persistenceAvailable: boolean;
  onDeleteSavedProfile: () => void | Promise<void>;
};

export function PayerProfileForm({
  values,
  onChange,
  saveProfile,
  onSaveProfileChange,
  hasSavedProfile,
  persistenceAvailable,
  onDeleteSavedProfile,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Some o pedido de confirmação se o perfil deixar de existir.
  useEffect(() => {
    if (!hasSavedProfile || !persistenceAvailable) setConfirmingDelete(false);
  }, [hasSavedProfile, persistenceAvailable]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteSavedProfile();
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const text = (field: keyof PayerProfileFormValues, label: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label className={labelClass} htmlFor={`payer-${field}`}>{label}</label>
      <input
        id={`payer-${field}`}
        value={values[field]}
        onChange={(event) => onChange({ [field]: event.target.value } as Partial<PayerProfileFormValues>)}
        className={inputClass}
        {...extra}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="payer-email">E-mail para receber a chave</label>
        <input
          id="payer-email"
          type="email"
          value={values.email}
          onChange={(event) => onChange({ email: event.target.value })}
          autoComplete="email"
          className={inputClass}
          placeholder="voce@exemplo.com"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {text('firstName', 'Nome', { autoComplete: 'given-name' })}
        {text('lastName', 'Sobrenome', { autoComplete: 'family-name' })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="payer-documentType">Tipo de documento</label>
          <select
            id="payer-documentType"
            value={values.documentType}
            onChange={(event) => onChange({ documentType: event.target.value === 'CNPJ' ? 'CNPJ' : 'CPF' })}
            className={inputClass}
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        {text('documentNumber', 'Número do documento', {
          inputMode: 'numeric',
          placeholder: values.documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00',
        })}
      </div>

      {text('phone', 'Telefone', { inputMode: 'tel', autoComplete: 'tel', placeholder: '(00) 00000-0000' })}

      <div className="grid grid-cols-[1fr_2fr_80px] gap-3">
        {text('zipCode', 'CEP', { inputMode: 'numeric', autoComplete: 'postal-code', placeholder: '00000-000' })}
        {text('streetName', 'Rua', { autoComplete: 'address-line1' })}
        {text('streetNumber', 'Número', { inputMode: 'numeric' })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {text('neighborhood', 'Bairro')}
        {text('city', 'Cidade', { autoComplete: 'address-level2' })}
      </div>

      <div className="grid grid-cols-[80px_1fr] gap-3">
        {text('state', 'Estado (UF)', { maxLength: 2, autoComplete: 'address-level1', placeholder: 'GO' })}
        {text('complement', 'Complemento', { placeholder: 'Opcional' })}
      </div>

      {persistenceAvailable && (
        <div className="flex items-start gap-3 rounded-lg border border-white/10 px-3.5 py-3 hover:border-white/20 transition-colors">
          <input
            id="payer-save-profile"
            type="checkbox"
            checked={saveProfile}
            onChange={(event) => onSaveProfileChange(event.target.checked)}
            className="mt-0.5 accent-[#E6B566]"
          />
          <div>
            <label
              htmlFor="payer-save-profile"
              className="block text-sm font-medium text-[#F5F3EF] cursor-pointer"
            >
              Salvar meus dados para próximas compras
            </label>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Guardamos com criptografia e só para você reusar. Pode apagar quando quiser.
            </p>
          </div>
        </div>
      )}

      {persistenceAvailable && hasSavedProfile && (
        <div className="text-xs">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 text-[#A8A8A4] hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} /> Apagar dados salvos
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
              <p className="text-[#F5F3EF]">
                Apagar os dados salvos? Seus pedidos, pagamentos e licenças não são afetados.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 font-medium text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {deleting && <Loader2 size={12} className="animate-spin" />} Confirmar exclusão
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[#A8A8A4] hover:text-[#F5F3EF]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
