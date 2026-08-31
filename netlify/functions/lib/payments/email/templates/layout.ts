/**
 * Layout base dos e-mails financeiros.
 *
 * Identidade DAVIMF: fundo ink (#0A0A0A), acento âmbar (#E6B566), texto
 * #F5F3EF — os mesmos tokens de tailwind.config.js. HTML de e-mail: tabelas,
 * estilo inline e largura fixa com `max-width`, que é o que os clientes
 * (Gmail/Outlook) renderizam de forma previsível.
 */

import { EMAIL_REPLY_TO, EMAIL_SUPPORT } from '../EmailProvider';

const DATA_PALETTE_EMAIL = {
  ink: '#0A0A0A',
  surface: '#121211',
  panel: '#1A1A18',
  border: '#2A2A26',
  text: '#F5F3EF',
  muted: '#A8A8A4',
  accent: '#E6B566',
  accentSoft: '#F0CF95',
  success: '#4ADE80',
  danger: '#F87171',
  noticeBackground: 'rgba(230,181,102,0.06)',
};

export const BRAND = DATA_PALETTE_EMAIL;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type DetailRow = { label: string; value: string };

export function detailsTable(rows: DetailRow[]): string {
  if (rows.length === 0) return '';
  const cells = rows
    .map(
      ({ label, value }) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:14px;">${escapeHtml(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:14px;text-align:right;font-weight:600;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;">${cells}</table>`;
}

export function button(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-radius:999px;background:${BRAND.text};">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${BRAND.ink};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>`;
}

export function codeBlock(value: string, options: { accent?: boolean } = {}): string {
  const color = options.accent ? BRAND.accent : BRAND.text;
  return `
    <div style="margin:20px 0;padding:16px 18px;background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;">
      <code style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:17px;letter-spacing:2px;color:${color};word-break:break-all;">${escapeHtml(value)}</code>
    </div>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.muted};">${text}</p>`;
}

export function notice(text: string, tone: 'accent' | 'danger' = 'accent'): string {
  const color = tone === 'danger' ? BRAND.danger : BRAND.accent;
  return `
    <div style="margin:20px 0;padding:14px 16px;border-left:3px solid ${color};background:${BRAND.noticeBackground};border-radius:0 8px 8px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.text};">${text}</p>
    </div>`;
}

export type LayoutInput = {
  title: string;
  preheader: string;
  body: string;
};

export function renderLayout({ title, preheader, body }: LayoutInput): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ink};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0;">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:${BRAND.accent};letter-spacing:-0.5px;">Davimf<span style="color:${BRAND.text};">.dev</span></span>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;font-family:Helvetica,Arial,sans-serif;">
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.text};">${escapeHtml(title)}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
            Dúvidas financeiras: <a href="mailto:${EMAIL_REPLY_TO}" style="color:${BRAND.accent};text-decoration:none;">${EMAIL_REPLY_TO}</a>
          </p>
          <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
            Suporte: <a href="mailto:${EMAIL_SUPPORT}" style="color:${BRAND.accent};text-decoration:none;">${EMAIL_SUPPORT}</a>
          </p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted};">
            Este e-mail foi enviado automaticamente por davimf.dev. Nunca pedimos número de cartão ou CVV por e-mail.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Versão texto puro — obrigatória para entregabilidade e leitores sem HTML. */
export function renderText(lines: Array<string | null | undefined>): string {
  return [...lines.filter((line): line is string => Boolean(line)), '', `Financeiro: ${EMAIL_REPLY_TO}`, `Suporte: ${EMAIL_SUPPORT}`].join('\n');
}
