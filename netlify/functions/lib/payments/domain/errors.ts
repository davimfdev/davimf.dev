/**
 * Erros do domínio de pagamentos.
 *
 * `code` é estável e seguro para o cliente; `message` NUNCA carrega detalhe
 * interno do provider (isso vai para o log e para payment_events.error).
 */

export class PaymentError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 400, retryable = false) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export class ValidationError extends PaymentError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(code, message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends PaymentError {
  constructor(message = 'Autenticação necessária.', code = 'UNAUTHORIZED') {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends PaymentError {
  constructor(message = 'Acesso negado.', code = 'FORBIDDEN') {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends PaymentError {
  constructor(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends PaymentError {
  constructor(message: string, code = 'CONFLICT') {
    super(code, message, 409);
    this.name = 'ConflictError';
  }
}

/** Falha de comunicação com o provider - o pagamento pode ou não ter ocorrido. */
export class ProviderError extends PaymentError {
  readonly providerDetail?: string;

  constructor(message: string, options: { code?: string; status?: number; retryable?: boolean; detail?: string } = {}) {
    super(options.code ?? 'PROVIDER_ERROR', message, options.status ?? 502, options.retryable ?? false);
    this.name = 'ProviderError';
    this.providerDetail = options.detail;
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(message = 'O provedor de pagamento não respondeu a tempo.') {
    super(message, { code: 'PROVIDER_TIMEOUT', status: 504, retryable: true });
    this.name = 'ProviderTimeoutError';
  }
}
