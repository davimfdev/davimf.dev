/**
 * Camada HTTP do módulo de pagamentos: autenticação, CORS de mutação,
 * validação de entrada e serialização de erro.
 *
 * REGRAS:
 *  - o userId vem SEMPRE da sessão; nunca do corpo da requisição;
 *  - nenhum campo de preço é lido do cliente;
 *  - a mensagem devolvida nunca vaza detalhe interno do provider.
 */

import { describeDatabases, isMissingRelationError } from '../db';
import { configuredSupportIds } from '../dashboard/guildAccess';
import { requireDashboardSession } from '../dashboard/session';
import { PaymentError, UnauthorizedError, ValidationError } from './domain/errors';
import type { PayerProfileData } from './repositories/PayerProfileRepository';
import type { Payer, PayerAddress, PayerIdentification } from './providers/PaymentProvider';

const ALLOWED_ORIGINS = [
  'https://davimf.dev',
  'https://www.davimf.dev',
  'http://localhost:8888',
  'http://localhost:5173',
  'http://localhost:3000',
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function headersOf(request: Request): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/** Mutação só do domínio oficial (Origin, senão Referer) - mesmo critério de lib/cors.ts. */
export function originAllowed(request: Request): boolean {
  if (!MUTATING.has(request.method.toUpperCase())) return true;
  const source = request.headers.get('origin') ?? request.headers.get('referer') ?? '';
  try {
    return ALLOWED_ORIGINS.includes(new URL(source).origin);
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export function errorJson(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}

/** Converte erro de domínio em resposta. Detalhe interno só vai para o log. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof PaymentError) {
    const providerDetail = (error as { providerDetail?: string }).providerDetail;
    // Recusas do provider são 4xx/422 para o comprador, mas o detalhe técnico
    // precisa existir no log operacional; sem ele todas as validações da API
    // externa viram a mesma mensagem genérica e não há como identificar o
    // campo/configuração rejeitado. O detalhe continua fora da resposta HTTP.
    if (error.status >= 500 || providerDetail) {
      console.error(`[payments] ${error.code}:`, providerDetail ?? error.message);
    }
    return errorJson(error.code, error.message, error.status);
  }

  // Tabela do módulo ausente = migração não aplicada (ou aplicada em OUTRO
  // banco). Sem esta ramificação isso vira um 500 genérico e o operador fica
  // caçando um problema de pagamento que na verdade é de schema.
  if (isMissingRelationError(error)) {
    const relation = /relation "([^"]+)" does not exist/.exec(String((error as Error).message))?.[1];
    const targets = describeDatabases()
      .filter((target) => target.label === 'auth/FMM/pagamentos')
      .map((target) => `${target.envVar ?? '(não definida)'} → ${target.host ?? '?'}/${target.database ?? '?'}`)
      .join(', ');
    console.error(
      `[payments] tabela "${relation ?? '?'}" não existe no banco de pagamentos (${targets}). ` +
        'Aplique a migração: psql "$DATABASE_URL" -f db/005_payments.sql',
    );
    return errorJson(
      'PAYMENTS_SCHEMA_MISSING',
      'Pagamentos indisponíveis: o banco não está migrado. Avise o suporte.',
      503,
    );
  }

  console.error('[payments] erro não tratado:', error);
  return errorJson('INTERNAL_ERROR', 'Erro interno ao processar o pagamento.', 500);
}

// ------------------------------------------------------------ autenticação --

export type AuthenticatedUser = { id: string; isAdmin: boolean; registeredAt?: string };

/**
 * Identidade a partir da sessão do site (cookie assinado do login Discord).
 * Nunca aceita `userId` do corpo.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const result = await requireDashboardSession({ headers: headersOf(request) });
  if (!result.ok) {
    throw new UnauthorizedError('Faça login para continuar.', result.code);
  }
  let isAdmin = false;
  try {
    isAdmin = configuredSupportIds().has(result.session.userId);
  } catch {
    isAdmin = false;
  }
  return {
    id: result.session.userId,
    isAdmin,
    ...(result.session.registeredAt ? { registeredAt: result.session.registeredAt } : {}),
  };
}

// --------------------------------------------------------------- validação --

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ValidationError('Corpo da requisição ilegível.', 'INVALID_BODY');
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError('Corpo da requisição inválido.', 'INVALID_BODY');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('JSON inválido.', 'INVALID_JSON');
  }
}

export function requireString(body: Record<string, unknown>, field: string, maxLength = 200): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Campo "${field}" é obrigatório.`, 'FIELD_REQUIRED');
  }
  if (value.length > maxLength) {
    throw new ValidationError(`Campo "${field}" é longo demais.`, 'FIELD_TOO_LONG');
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, field: string, maxLength = 200): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ValidationError(`Campo "${field}" inválido.`, 'FIELD_INVALID');
  }
  return value.trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function requireEmail(body: Record<string, unknown>, field = 'email'): string {
  const value = requireString(body, field, 254).toLowerCase();
  if (!EMAIL_RE.test(value)) throw new ValidationError('E-mail inválido.', 'INVALID_EMAIL');
  return value;
}

export function optionalInt(body: Record<string, unknown>, field: string): number | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ValidationError(`Campo "${field}" inválido.`, 'FIELD_INVALID');
  return parsed;
}

/**
 * Só CPF/CNPJ com dígitos. Nenhum campo de cartão é aceito em lugar nenhum da
 * API - se aparecer, é erro explícito, não silêncio.
 */
const FORBIDDEN_CARD_FIELDS = [
  'card_number', 'cardNumber', 'pan', 'number',
  'security_code', 'securityCode', 'cvv', 'cvc',
];

export function rejectRawCardData(body: Record<string, unknown>): void {
  for (const field of FORBIDDEN_CARD_FIELDS) {
    if (field in body) {
      // Não logamos o valor - só o nome do campo.
      console.error(`[payments] requisição rejeitada: campo sensível "${field}" enviado ao backend`);
      throw new ValidationError(
        'Dados de cartão não devem ser enviados ao servidor. Use a tokenização do checkout.',
        'RAW_CARD_DATA_REJECTED',
      );
    }
  }
}

function payerBody(body: Record<string, unknown>): Record<string, unknown> {
  return (body.payer && typeof body.payer === 'object' && !Array.isArray(body.payer) ? body.payer : body) as Record<string, unknown>;
}

function optionalPayerString(payer: Record<string, unknown>, field: string, maxLength: number): string | undefined {
  const value = payer[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new ValidationError(`Campo "${field}" inválido.`, 'FIELD_INVALID');
  }
  return value.trim();
}

function requirePayerString(payer: Record<string, unknown>, field: string, maxLength: number): string {
  return requireString(payer, field, maxLength);
}

function normalizeDigits(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new ValidationError(`Campo "${field}" inválido.`, 'FIELD_INVALID');
  const digits = value.replace(/\D/g, '');
  if (digits.length < min || digits.length > max) {
    throw new ValidationError(`Campo "${field}" inválido.`, 'FIELD_INVALID');
  }
  return digits;
}

function parseIdentification(payer: Record<string, unknown>, required: boolean): PayerIdentification | undefined {
  const raw = payer.identification;
  if (raw === undefined || raw === null) {
    if (required) throw new ValidationError('CPF/CNPJ é obrigatório.', 'PAYER_IDENTIFICATION_REQUIRED');
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('CPF/CNPJ inválido.', 'INVALID_IDENTIFICATION');
  const identification = raw as Record<string, unknown>;
  const number = normalizeDigits(identification.number, 'identification.number', 11, 14);
  if (number.length !== 11 && number.length !== 14) throw new ValidationError('CPF/CNPJ inválido.', 'INVALID_IDENTIFICATION');
  const type = typeof identification.type === 'string' ? identification.type.trim().toUpperCase() : number.length === 11 ? 'CPF' : 'CNPJ';
  if ((type !== 'CPF' && type !== 'CNPJ') || (type === 'CPF' && number.length !== 11) || (type === 'CNPJ' && number.length !== 14)) {
    throw new ValidationError('CPF/CNPJ inválido.', 'INVALID_IDENTIFICATION');
  }
  return { type, number };
}

function parseAddress(payer: Record<string, unknown>, required: boolean): PayerAddress | undefined {
  const raw = payer.address;
  if (raw === undefined || raw === null) {
    if (required) throw new ValidationError('Endereço é obrigatório.', 'PAYER_ADDRESS_REQUIRED');
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Endereço inválido.', 'INVALID_ADDRESS');
  const address = raw as Record<string, unknown>;
  const state = requirePayerString(address, 'state', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new ValidationError('Endereço inválido.', 'INVALID_ADDRESS');
  return {
    zipCode: normalizeDigits(address.zipCode, 'address.zipCode', 8, 8),
    streetName: requirePayerString(address, 'streetName', 120),
    streetNumber: requirePayerString(address, 'streetNumber', 20),
    neighborhood: requirePayerString(address, 'neighborhood', 100),
    city: requirePayerString(address, 'city', 100),
    state,
    complement: optionalPayerString(address, 'complement', 120),
  };
}

function payerEmail(payer: Record<string, unknown>, fallbackEmail?: string): string {
  if (payer.email === undefined || payer.email === null || payer.email === '') {
    if (fallbackEmail) return fallbackEmail;
    throw new ValidationError('E-mail é obrigatório.', 'FIELD_REQUIRED');
  }
  return requireEmail(payer);
}

/** Parses optional payer details for a charge, validating every supplied field. */
export function parsePayer(body: Record<string, unknown>, fallbackEmail: string): Payer {
  const payer = payerBody(body);
  rejectRawCardData(body);
  rejectRawCardData(payer);
  return {
    email: payerEmail(payer, fallbackEmail),
    firstName: optionalPayerString(payer, 'firstName', 60),
    lastName: optionalPayerString(payer, 'lastName', 60),
    phone: payer.phone === undefined || payer.phone === null || payer.phone === ''
      ? undefined
      : normalizeDigits(payer.phone, 'phone', 10, 15),
    identification: parseIdentification(payer, false),
    address: parseAddress(payer, false),
  };
}

/** Parses a complete profile before it can be stored through explicit consent. */
export function parsePayerProfile(body: Record<string, unknown>): PayerProfileData {
  const payer = payerBody(body);
  rejectRawCardData(body);
  rejectRawCardData(payer);
  const address = parseAddress(payer, true);
  if (!address?.neighborhood || !address.city || !address.state) {
    throw new ValidationError('Endereço inválido.', 'INVALID_ADDRESS');
  }
  return {
    firstName: requirePayerString(payer, 'firstName', 60),
    lastName: requirePayerString(payer, 'lastName', 60),
    email: payerEmail(payer),
    phone: payer.phone === undefined || payer.phone === null || payer.phone === ''
      ? undefined
      : normalizeDigits(payer.phone, 'phone', 10, 15),
    identification: parseIdentification(payer, true)!,
    address: {
      zipCode: address.zipCode,
      streetName: address.streetName,
      streetNumber: address.streetNumber,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      complement: address.complement,
    },
  };
}

/**
 * Perfil que o CONSENTIMENTO manda guardar.
 *
 * O corpo pode trazer um `payerProfile` separado do `payer` da transação: no
 * cartão o pagador da transação carrega o documento do PORTADOR (é o que o
 * emissor valida), e o que o usuário revisou na identificação não pode ser
 * perdido por causa disso. Campo opcional e SÓ-DE-PERFIL: é consumido aqui e
 * nunca entra no payload do provider.
 *
 * Sem `payerProfile`, o perfil continua saindo do próprio `payer` - a
 * validação estrita de `parsePayerProfile` é a mesma nos dois caminhos.
 */
export function parseConsentedPayerProfile(body: Record<string, unknown>): PayerProfileData {
  const raw = body.payerProfile;
  if (raw === undefined || raw === null) return parsePayerProfile(body);
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Campo "payerProfile" inválido.', 'FIELD_INVALID');
  }
  // Reembrulhado como `payer` para reusar exatamente o mesmo parser - cada
  // campo segue limitado em tipo e tamanho, e dados de cartão seguem recusados.
  return parsePayerProfile({ payer: raw as Record<string, unknown> });
}

/**
 * Limite defensivo do Device ID na fronteira pública. O SDK gera um
 * identificador curto - nada além disso é aceito aqui.
 */
const DEVICE_ID_MAX_LENGTH = 300;

/**
 * Device ID opcional do MercadoPago.js.
 *
 * REQUEST-SCOPED: o valor só atravessa a requisição até o header do provider.
 * Nunca é persistido, nunca é logado e nunca volta na resposta - por isso a
 * mensagem de erro também não repete o valor recebido.
 */
export function parseDeviceId(body: Record<string, unknown>): string | undefined {
  const value = body.deviceId;
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > DEVICE_ID_MAX_LENGTH) {
    throw new ValidationError('Campo "deviceId" inválido.', 'FIELD_INVALID');
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Only the literal true records reusable payer details. */
export function parseSavePayerProfile(body: Record<string, unknown>): boolean {
  const value = body.savePayerProfile;
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new ValidationError('Consentimento de perfil inválido.', 'INVALID_PAYER_PROFILE_CONSENT');
  return value;
}
