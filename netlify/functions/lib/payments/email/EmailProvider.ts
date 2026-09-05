/**
 * Abstração de e-mail.
 *
 * NotificationService só conhece esta interface. Para trocar Resend por
 * SES/Postmark, implemente EmailProvider e registre em getEmailProvider().
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Repassada ao provider quando ele suporta idempotência nativa. */
  idempotencyKey?: string;
};

export type EmailSendResult = { id: string | null };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Identidade do remetente - todos os endereços são @davimf.dev. */
export const EMAIL_FROM = process.env.PAYMENTS_EMAIL_FROM ?? 'DAVIMF <noreply@davimf.dev>';
export const EMAIL_REPLY_TO = process.env.PAYMENTS_EMAIL_REPLY_TO ?? 'financeiro@davimf.dev';
export const EMAIL_SUPPORT = process.env.PAYMENTS_EMAIL_SUPPORT ?? 'contato@davimf.dev';
