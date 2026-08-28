/**
 * NotificationService — decide QUANDO notificar; EmailProvider decide COMO.
 *
 * Regras invioláveis:
 *  - todo evento financeiro relevante gera e-mail ao comprador;
 *  - a deduplicação é feita ANTES do envio, por chave estável do evento;
 *  - polling nunca chama este serviço (só webhook e ações do usuário);
 *  - falha de e-mail NUNCA invalida pedido ou licença — só marca FAILED.
 */

import { getEmailProvider } from '../email/ResendEmailProvider';
import type { EmailProvider } from '../email/EmailProvider';
import type { RenderedEmail } from '../email/templates';
import {
  claimEmail,
  markEmailFailed,
  markEmailSent,
  reopenFailedEmail,
} from '../repositories/EmailDispatchRepository';

export type NotifyInput = {
  /** Estável e único por evento: `order:<id>:paid`, `sub:<id>:renewed:<ts>`. */
  dedupeKey: string;
  template: string;
  recipient: string;
  orderId?: string | null;
  email: RenderedEmail;
};

export type NotifyResult = { sent: boolean; deduped: boolean; error?: string };

export class NotificationService {
  private readonly provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? getEmailProvider();
  }

  /**
   * Nunca lança: o chamador está no meio de um fluxo financeiro já
   * committado, e um provedor de e-mail fora do ar não pode desfazer a venda.
   */
  async notify(input: NotifyInput): Promise<NotifyResult> {
    if (!input.recipient) return { sent: false, deduped: false, error: 'RECIPIENT_MISSING' };

    let claimed;
    try {
      claimed = await claimEmail({
        dedupeKey: input.dedupeKey,
        template: input.template,
        recipient: input.recipient,
        orderId: input.orderId ?? null,
      });
    } catch (error) {
      console.error('[payments] falha ao registrar envio de e-mail:', error);
      return { sent: false, deduped: false, error: 'DISPATCH_CLAIM_FAILED' };
    }

    if (!claimed) {
      // Já enviado (ou em envio) por outro caminho. Retenta só o que falhou.
      const reopened = await reopenFailedEmail(input.dedupeKey).catch(() => null);
      if (!reopened) return { sent: false, deduped: true };
      claimed = reopened;
    }

    try {
      const result = await this.provider.send({
        to: input.recipient,
        subject: input.email.subject,
        html: input.email.html,
        text: input.email.text,
        idempotencyKey: input.dedupeKey,
      });
      await markEmailSent(claimed.id, result.id);
      return { sent: true, deduped: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[payments] e-mail "${input.template}" falhou (pedido segue válido):`, message);
      await markEmailFailed(claimed.id, message).catch(() => undefined);
      return { sent: false, deduped: false, error: message };
    }
  }
}

let cached: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  return (cached ??= new NotificationService());
}

export function setNotificationServiceForTesting(service: NotificationService | null): void {
  cached = service;
}
