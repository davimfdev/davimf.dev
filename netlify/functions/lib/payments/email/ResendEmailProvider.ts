/**
 * ResendEmailProvider — implementação de EmailProvider sobre a API REST do
 * Resend (POST https://api.resend.com/emails).
 *
 * Usa fetch direto em vez do pacote `resend` porque os handlers de
 * netlify/functions/ são compilados tanto pelo package.json da raiz quanto pelo
 * de server/ (imagem Docker), e `resend` só existe no primeiro — uma
 * dependência a mais aqui derrubaria o container em runtime.
 */

import { ProviderError, ProviderTimeoutError } from '../domain/errors';
import { EMAIL_FROM, EMAIL_REPLY_TO, type EmailMessage, type EmailProvider, type EmailSendResult } from './EmailProvider';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS ?? 10_000);

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  private readonly fetchImpl: typeof fetch;
  private readonly apiKey?: string;
  private readonly endpoint: string;

  constructor(options: { apiKey?: string; fetchImpl?: typeof fetch; endpoint?: string } = {}) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoint = options.endpoint ?? RESEND_ENDPOINT;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.apiKey ?? process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new ProviderError('Serviço de e-mail não configurado.', {
        code: 'EMAIL_NOT_CONFIGURED',
        status: 503,
        retryable: true,
        detail: 'RESEND_API_KEY ausente',
      });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    // Idempotência nativa do Resend: retry com a mesma chave não duplica envio.
    if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [message.to],
          reply_to: EMAIL_REPLY_TO,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError' || name === 'TimeoutError') throw new ProviderTimeoutError('E-mail não enviado: tempo esgotado.');
      throw new ProviderError('Não foi possível enviar o e-mail.', {
        code: 'EMAIL_UNREACHABLE',
        retryable: true,
        detail: (error as Error)?.message,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    if (text) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }

    if (!response.ok) {
      throw new ProviderError('O serviço de e-mail recusou o envio.', {
        code: 'EMAIL_REJECTED',
        retryable: response.status >= 500 || response.status === 429,
        detail: `HTTP ${response.status} ${String(payload.message ?? '').slice(0, 300)}`,
      });
    }

    return { id: typeof payload.id === 'string' ? payload.id : null };
  }
}

/** Provider nulo: em sandbox sem RESEND_API_KEY nada quebra, só não envia. */
export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop';
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    console.warn(`[payments] RESEND_API_KEY ausente — e-mail "${message.subject}" não enviado.`);
    return { id: null };
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  cached = process.env.RESEND_API_KEY ? new ResendEmailProvider() : new NoopEmailProvider();
  return cached;
}

export function setEmailProviderForTesting(provider: EmailProvider | null): void {
  cached = provider;
}
