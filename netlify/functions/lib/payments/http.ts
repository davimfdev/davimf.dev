/**
 * Camada HTTP do módulo de pagamentos: autenticação, CORS de mutação,
 * validação de entrada e serialização de erro.
 *
 * REGRAS:
 *  - o userId vem SEMPRE da sessão; nunca do corpo da requisição;
 *  - nenhum campo de preço é lido do cliente;
 *  - a mensagem devolvida nunca vaza detalhe interno do provider.
 */

import { configuredSupportIds } from '../dashboard/guildAccess';
import { requireDashboardSession } from '../dashboard/session';
import { PaymentError, UnauthorizedError, ValidationError } from './domain/errors';

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

/** Mutação só do domínio oficial (Origin, senão Referer) — mesmo critério de lib/cors.ts. */
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
    if (error.status >= 500) {
      console.error(`[payments] ${error.code}:`, (error as { providerDetail?: string }).providerDetail ?? error.message);
    }
    return errorJson(error.code, error.message, error.status);
  }
  console.error('[payments] erro não tratado:', error);
  return errorJson('INTERNAL_ERROR', 'Erro interno ao processar o pagamento.', 500);
}

// ------------------------------------------------------------ autenticação --

export type AuthenticatedUser = { id: string; isAdmin: boolean };

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
  return { id: result.session.userId, isAdmin };
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
 * API — se aparecer, é erro explícito, não silêncio.
 */
const FORBIDDEN_CARD_FIELDS = [
  'card_number', 'cardNumber', 'pan', 'number',
  'security_code', 'securityCode', 'cvv', 'cvc',
];

export function rejectRawCardData(body: Record<string, unknown>): void {
  for (const field of FORBIDDEN_CARD_FIELDS) {
    if (field in body) {
      // Não logamos o valor — só o nome do campo.
      console.error(`[payments] requisição rejeitada: campo sensível "${field}" enviado ao backend`);
      throw new ValidationError(
        'Dados de cartão não devem ser enviados ao servidor. Use a tokenização do checkout.',
        'RAW_CARD_DATA_REJECTED',
      );
    }
  }
}

export function parsePayer(body: Record<string, unknown>, fallbackEmail: string) {
  const payer = (body.payer && typeof body.payer === 'object' ? body.payer : {}) as Record<string, unknown>;
  rejectRawCardData(payer);

  const identificationRaw = (payer.identification && typeof payer.identification === 'object'
    ? payer.identification
    : {}) as Record<string, unknown>;

  const documentNumber = typeof identificationRaw.number === 'string'
    ? identificationRaw.number.replace(/\D/g, '')
    : undefined;

  const addressRaw = (payer.address && typeof payer.address === 'object' ? payer.address : null) as Record<string, unknown> | null;

  return {
    email: typeof payer.email === 'string' && EMAIL_RE.test(payer.email) ? payer.email.toLowerCase() : fallbackEmail,
    firstName: optionalString(payer, 'firstName', 60),
    lastName: optionalString(payer, 'lastName', 60),
    identification: documentNumber
      ? {
          type: typeof identificationRaw.type === 'string' ? identificationRaw.type : documentNumber.length > 11 ? 'CNPJ' : 'CPF',
          number: documentNumber,
        }
      : undefined,
    address: addressRaw
      ? {
          zipCode: String(addressRaw.zipCode ?? '').replace(/\D/g, ''),
          streetName: String(addressRaw.streetName ?? ''),
          streetNumber: String(addressRaw.streetNumber ?? ''),
          neighborhood: addressRaw.neighborhood ? String(addressRaw.neighborhood) : undefined,
          city: addressRaw.city ? String(addressRaw.city) : undefined,
          state: addressRaw.state ? String(addressRaw.state) : undefined,
        }
      : undefined,
  };
}
