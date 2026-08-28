// @vitest-environment jsdom
/**
 * Perfil reutilizável do pagador.
 *
 * O que este arquivo protege:
 *  - dados de cartão NUNCA entram neste formulário (ficam no CardForm/Secure Fields);
 *  - o consentimento nasce DESMARCADO, mesmo com o formulário pré-preenchido;
 *  - `savePayerProfile` espelha exatamente a caixa de seleção;
 *  - apagar exige confirmação e só aparece quando há perfil salvo;
 *  - pagar continua possível quando a persistência de perfil está indisponível.
 */

import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PayerProfileForm, emptyPayerProfileValues, type PayerProfileFormValues } from '../PayerProfileForm';
import { CheckoutModal } from '../CheckoutModal';
import type { CatalogProduct, PayerProfile } from '../api';

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

const SAVED_PROFILE: PayerProfile = {
  firstName: 'Davi',
  lastName: 'Moraes',
  email: 'davi@example.com',
  phone: '62999999999',
  identification: { type: 'CPF', number: '12345678909' },
  address: {
    zipCode: '01310100',
    streetName: 'Avenida Paulista',
    streetNumber: '1000',
    neighborhood: 'Bela Vista',
    city: 'Sao Paulo',
    state: 'SP',
    complement: 'Apto 42',
  },
};

const FILLED_VALUES: PayerProfileFormValues = {
  firstName: 'Davi',
  lastName: 'Moraes',
  email: 'davi@example.com',
  phone: '62999999999',
  documentType: 'CPF',
  documentNumber: '12345678909',
  zipCode: '01310100',
  streetName: 'Avenida Paulista',
  streetNumber: '1000',
  neighborhood: 'Bela Vista',
  city: 'Sao Paulo',
  state: 'SP',
  complement: 'Apto 42',
};

const PIX_PAYMENT = {
  id: 'pay-1',
  orderId: 'order-1',
  orderReference: 'DVMF-TEST0001',
  productName: PRODUCT.name,
  method: 'pix' as const,
  status: 'PENDING' as const,
  amountCents: 3500,
  currency: 'BRL',
  installments: 1,
  expiresAt: null,
  pix: { qrCode: '00020126PIX', qrCodeBase64: null, ticketUrl: null },
  threeDsUrl: null,
};

/**
 * O SDK real reconhece a bandeira por um evento `binChange` disparado de
 * dentro do iframe. O fake guarda o handler para que o teste de cartão consiga
 * chegar ao envio — sem BIN, o `CardForm` recusa submeter.
 */
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

function setDeviceSessionId(value: string | undefined): void {
  if (value === undefined) delete (window as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID;
  else (window as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID = value;
}

// ------------------------------------------------------------ componente ---

describe('PayerProfileForm', () => {
  afterEach(cleanup);

  function renderForm(overrides: Partial<ComponentProps<typeof PayerProfileForm>> = {}) {
    const props = {
      values: FILLED_VALUES,
      onChange: vi.fn(),
      saveProfile: false,
      onSaveProfileChange: vi.fn(),
      hasSavedProfile: false,
      persistenceAvailable: true,
      onDeleteSavedProfile: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const view = render(<PayerProfileForm {...props} />);
    return { ...view, props };
  }

  it('mostra os valores pré-preenchidos e permite editá-los', () => {
    const { props } = renderForm();

    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Davi');
    expect((screen.getByLabelText('Número do documento') as HTMLInputElement).value).toBe('12345678909');
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('Sao Paulo');

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Goiania' } });
    expect(props.onChange).toHaveBeenCalledWith({ city: 'Goiania' });
  });

  it('nunca consente sozinho — o consentimento sai só do clique do usuário', () => {
    const { props } = renderForm({ hasSavedProfile: true });

    // Um formulário pré-preenchido por perfil salvo não pode "reaproveitar" o
    // consentimento: nada é reportado enquanto o usuário não clica.
    expect(props.onSaveProfileChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Salvar meus dados para próximas compras'));
    expect(props.onSaveProfileChange).toHaveBeenCalledTimes(1);
    expect(props.onSaveProfileChange).toHaveBeenCalledWith(true);
  });

  it('deriva o tipo do documento do número em vez de oferecer uma escolha', () => {
    const { rerender } = renderForm();

    // Não existe seleção de tipo: escolher CNPJ e digitar 11 dígitos mandaria
    // CPF de qualquer jeito, então a UI mostra o que foi RECONHECIDO.
    expect(screen.queryByLabelText('Tipo de documento')).toBeNull();
    expect(screen.getByText(/Reconhecido como CPF/)).toBeTruthy();

    rerender(
      <PayerProfileForm
        values={{ ...FILLED_VALUES, documentType: 'CPF', documentNumber: '12345678000199' }}
        onChange={vi.fn()}
        saveProfile={false}
        onSaveProfileChange={vi.fn()}
        hasSavedProfile={false}
        persistenceAvailable
        onDeleteSavedProfile={vi.fn()}
      />,
    );
    // 14 dígitos são CNPJ mesmo com `documentType: 'CPF'` nos valores.
    expect(screen.getByText(/Reconhecido como CNPJ/)).toBeTruthy();
  });

  it('avisa que telefone curto e endereço parcial não são salvos nem enviados', () => {
    renderForm({ values: { ...FILLED_VALUES, phone: '629999', streetNumber: '', zipCode: '013' } });

    expect(screen.getByText(/Telefone incompleto/)).toBeTruthy();
    expect(screen.getByText(/Endereço incompleto/)).toBeTruthy();
  });

  it('não avisa nada quando telefone e endereço estão completos', () => {
    renderForm();

    expect(screen.queryByText(/Telefone incompleto/)).toBeNull();
    expect(screen.queryByText(/Endereço incompleto/)).toBeNull();
  });

  it('não oferece apagar quando não existe perfil salvo', () => {
    renderForm({ hasSavedProfile: false });
    expect(screen.queryByRole('button', { name: 'Apagar dados salvos' })).toBeNull();
  });

  it('exige confirmação explícita para apagar os dados salvos', async () => {
    const onDeleteSavedProfile = vi.fn().mockResolvedValue(undefined);
    renderForm({ hasSavedProfile: true, onDeleteSavedProfile });

    fireEvent.click(screen.getByRole('button', { name: 'Apagar dados salvos' }));
    expect(onDeleteSavedProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onDeleteSavedProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apagar dados salvos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(onDeleteSavedProfile).toHaveBeenCalledTimes(1));
  });

  it('esconde consentimento e exclusão quando a persistência está indisponível', () => {
    renderForm({ hasSavedProfile: true, persistenceAvailable: false });

    expect(screen.queryByLabelText('Salvar meus dados para próximas compras')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apagar dados salvos' })).toBeNull();
    expect(screen.getByLabelText('Nome')).toBeTruthy();
  });

  it('não contém nenhum campo de cartão — eles vivem fora deste componente', () => {
    const { container } = renderForm();

    expect(container.querySelector('#mp-card-number')).toBeNull();
    expect(container.querySelector('#mp-card-expiration')).toBeNull();
    expect(container.querySelector('#mp-card-security')).toBeNull();
    expect(container.innerHTML).not.toMatch(/cart[ãa]o|cvv|validade|cardholder/i);
  });

  it('expõe valores vazios seguros para um checkout sem perfil', () => {
    expect(emptyPayerProfileValues()).toEqual({
      firstName: '', lastName: '', email: '', phone: '', documentType: 'CPF', documentNumber: '',
      zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '', complement: '',
    });
  });
});

// ------------------------------------------------------------- integração --

describe('CheckoutModal com perfil reutilizável', () => {
  beforeEach(() => {
    (window as unknown as { MercadoPago?: unknown }).MercadoPago = FakeMercadoPago;
    binChangeHandlers = [];
    setDeviceSessionId('mp-real-id');
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
    paymentsApiMock.pix.mockResolvedValue({ payment: PIX_PAYMENT });
    paymentsApiMock.payerProfile.get.mockResolvedValue({ persistenceAvailable: true, profile: null });
    paymentsApiMock.payerProfile.delete.mockResolvedValue({ deleted: true });
  });

  afterEach(() => {
    cleanup();
    setDeviceSessionId(undefined);
    vi.clearAllMocks();
  });

  async function openCheckout(): Promise<void> {
    render(<CheckoutModal product={PRODUCT} onClose={() => undefined} />);
    await waitFor(() => expect(paymentsApiMock.payerProfile.get).toHaveBeenCalledTimes(1));
  }

  function fillPayer(): void {
    const values: Array<[string, string]> = [
      ['E-mail para receber a chave', 'davi@example.com'],
      ['Nome', 'Davi'],
      ['Sobrenome', 'Moraes'],
      ['Telefone', '62999999999'],
      ['Número do documento', '12345678909'],
      ['CEP', '01310100'],
      ['Rua', 'Avenida Paulista'],
      ['Número', '1000'],
      ['Bairro', 'Bela Vista'],
      ['Cidade', 'Sao Paulo'],
      ['Estado (UF)', 'SP'],
      ['Complemento', 'Apto 42'],
    ];
    for (const [label, value] of values) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
  }

  async function goToPix(): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const pixButton = await screen.findByRole('button', { name: /Gerar Pix/ });
    fireEvent.click(pixButton);
    await waitFor(() => expect(paymentsApiMock.pix).toHaveBeenCalledTimes(1));
  }

  it('pré-preenche o perfil salvo e mantém o consentimento desmarcado', async () => {
    paymentsApiMock.payerProfile.get.mockResolvedValue({ persistenceAvailable: true, profile: SAVED_PROFILE });

    await openCheckout();

    await waitFor(() => expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Davi'));
    expect((screen.getByLabelText('E-mail para receber a chave') as HTMLInputElement).value).toBe('davi@example.com');
    expect((screen.getByLabelText('Bairro') as HTMLInputElement).value).toBe('Bela Vista');
    expect((screen.getByLabelText('Salvar meus dados para próximas compras') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Apagar dados salvos' })).toBeTruthy();
  });

  it('envia savePayerProfile=false e os dados da transação quando o consentimento não é dado', async () => {
    await openCheckout();
    fillPayer();
    await goToPix();

    expect(paymentsApiMock.pix.mock.calls[0][0]).toMatchObject({
      orderId: 'order-1',
      savePayerProfile: false,
      deviceId: 'mp-real-id',
      payer: {
        email: 'davi@example.com',
        firstName: 'Davi',
        lastName: 'Moraes',
        phone: '62999999999',
        identification: { type: 'CPF', number: '12345678909' },
        address: {
          zipCode: '01310100', streetName: 'Avenida Paulista', streetNumber: '1000',
          neighborhood: 'Bela Vista', city: 'Sao Paulo', state: 'SP', complement: 'Apto 42',
        },
      },
    });
    expect(paymentsApiMock.payerProfile.put).not.toHaveBeenCalled();
  });

  it('envia savePayerProfile=true somente quando a caixa é marcada explicitamente', async () => {
    await openCheckout();
    fillPayer();
    fireEvent.click(screen.getByLabelText('Salvar meus dados para próximas compras'));
    await goToPix();

    expect(paymentsApiMock.pix.mock.calls[0][0]).toMatchObject({ savePayerProfile: true });
  });

  it('não envia consentimento nem Device ID na criação do pedido', async () => {
    await openCheckout();
    fillPayer();
    fireEvent.click(screen.getByLabelText('Salvar meus dados para próximas compras'));
    await goToPix();

    const checkoutBody = paymentsApiMock.checkout.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(checkoutBody)).not.toContain('savePayerProfile');
    expect(Object.keys(checkoutBody)).not.toContain('deviceId');
  });

  it('cobra sem Device ID quando o SDK não publicou um valor real', async () => {
    setDeviceSessionId(undefined);

    await openCheckout();
    fillPayer();
    await goToPix();

    expect((paymentsApiMock.pix.mock.calls[0][0] as { deviceId?: string }).deviceId).toBeUndefined();
  });

  it('mantém o pagamento utilizável quando a persistência de perfil está indisponível', async () => {
    paymentsApiMock.payerProfile.get.mockResolvedValue({ persistenceAvailable: false, profile: null });

    await openCheckout();
    expect(screen.queryByLabelText('Salvar meus dados para próximas compras')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apagar dados salvos' })).toBeNull();

    fillPayer();
    await goToPix();

    expect(paymentsApiMock.pix.mock.calls[0][0]).toMatchObject({ savePayerProfile: false });
  });

  it('apaga os dados salvos após confirmação e remove a ação', async () => {
    paymentsApiMock.payerProfile.get.mockResolvedValue({ persistenceAvailable: true, profile: SAVED_PROFILE });

    await openCheckout();
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar dados salvos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));

    await waitFor(() => expect(paymentsApiMock.payerProfile.delete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apagar dados salvos' })).toBeNull());
  });

  /**
   * Cartão + consentimento. A transação leva o documento do PORTADOR (é o que
   * o emissor valida); o perfil guarda a identificação que o usuário revisou
   * na etapa anterior. Sem essa separação, o CPF do portador vira o perfil
   * salvo e volta pré-preenchido na próxima compra.
   */
  it('cobra com o documento do portador e envia o perfil revisado para persistir', async () => {
    paymentsApiMock.card.mockResolvedValue({ payment: { ...PIX_PAYMENT, id: 'pay-2', method: 'card', pix: undefined } });

    await openCheckout();
    fillPayer();
    fireEvent.click(screen.getByLabelText('Salvar meus dados para próximas compras'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    fireEvent.click(await screen.findByRole('button', { name: /Cartão/ }));
    const holder = await screen.findByLabelText('Nome impresso no cartão');
    fireEvent.change(holder, { target: { value: 'DAVI M MORAES' } });
    // Documento do PORTADOR — deliberadamente diferente do perfil revisado.
    fireEvent.change(screen.getByLabelText('Número do documento'), { target: { value: '98765432100' } });

    // Sem BIN o SDK não reconhece a bandeira e o formulário recusa enviar.
    await act(async () => {
      for (const handler of binChangeHandlers) handler({ bin: '503175' });
    });
    fireEvent.click(screen.getByRole('button', { name: /Pagar agora/ }));
    await waitFor(() => expect(paymentsApiMock.card).toHaveBeenCalledTimes(1));

    const body = paymentsApiMock.card.mock.calls[0][0] as {
      savePayerProfile: boolean;
      payer: { identification: { number: string } };
      payerProfile?: PayerProfile;
    };
    expect(body.savePayerProfile).toBe(true);
    expect(body.payer.identification).toEqual({ type: 'CPF', number: '98765432100' });
    expect(body.payerProfile?.identification).toEqual({ type: 'CPF', number: '12345678909' });
    expect(body.payerProfile?.address).toMatchObject({ zipCode: '01310100', city: 'Sao Paulo' });
  });

  it('não envia perfil para persistir quando o consentimento não foi dado', async () => {
    await openCheckout();
    fillPayer();
    await goToPix();

    expect(paymentsApiMock.pix.mock.calls[0][0]).not.toHaveProperty('payerProfile');
  });

  it('não sobrescreve o que já está sendo digitado quando o perfil salvo chega', async () => {
    let resolveProfile: (value: { persistenceAvailable: boolean; profile: PayerProfile | null }) => void = () => undefined;
    paymentsApiMock.payerProfile.get.mockReturnValue(
      new Promise<{ persistenceAvailable: boolean; profile: PayerProfile | null }>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    render(<CheckoutModal product={PRODUCT} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Joana' } });
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Goiania' } });

    await act(async () => {
      resolveProfile({ persistenceAvailable: true, profile: SAVED_PROFILE });
    });

    // O GET resolveu (a exclusão apareceu) mas o que estava sendo digitado fica.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apagar dados salvos' })).toBeTruthy());
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Joana');
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('Goiania');
  });
});
