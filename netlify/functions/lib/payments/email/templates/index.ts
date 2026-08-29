/**
 * Templates dos e-mails financeiros.
 *
 * Cada template é uma função pura (dados -> {subject, html, text}); nenhum
 * deles gera chave, consulta banco ou fala com provider. A chave de licença
 * chega pronta, já persistida — o e-mail NUNCA é onde ela nasce.
 */

import { siteUrl } from '../../config';
import { formatMoney } from '../../domain/money';
import type { LegalAcceptance } from '../../domain/types';
import type { EmailMessage } from '../EmailProvider';
import {
  BRAND,
  button,
  codeBlock,
  detailsTable,
  escapeHtml,
  notice,
  paragraph,
  renderLayout,
  renderText,
  type DetailRow,
} from './layout';

export type RenderedEmail = Pick<EmailMessage, 'subject' | 'html' | 'text'>;

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  card: 'Cartão de crédito',
  boleto: 'Boleto bancário',
  subscription: 'Assinatura no cartão',
};

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method;
}

export type OrderSummary = {
  reference: string;
  productName: string;
  amountCents: number;
  currency: string;
  method: string;
  /**
   * Versão dos documentos legais aceita neste pedido, com o hash calculado
   * pelo nosso próprio registro. `undefined` quando o chamador ainda não foi
   * atualizado para informar o dado; `null` quando o pedido é anterior à
   * migração e nunca teve aceite registrado — os dois casos renderizam o
   * e-mail igual, sem o bloco de links.
   */
  legalAcceptance?: LegalAcceptance | null;
};

function baseRows(order: OrderSummary, extra: DetailRow[] = []): DetailRow[] {
  return [
    { label: 'Pedido', value: order.reference },
    { label: 'Produto', value: order.productName },
    { label: 'Valor', value: formatMoney(order.amountCents, order.currency) },
    { label: 'Forma de pagamento', value: methodLabel(order.method) },
    ...extra,
  ];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

// ---------------------------------------------------------- pedido criado --

/**
 * Links para o SNAPSHOT exato aceito neste pedido — não para os documentos
 * atuais. `/legal/<versão>/...` é imutável, então o link continua mostrando
 * o texto que o cliente realmente aceitou mesmo depois de os documentos
 * serem revisados (Decreto 7.962/2013: o fornecedor tem que entregar o
 * contrato num formato que o consumidor consiga guardar e reproduzir).
 */
function legalAcceptanceBlock(acceptance: LegalAcceptance | null | undefined): string {
  if (!acceptance) return '';
  const version = encodeURIComponent(acceptance.version);
  const base = siteUrl();
  const termsUrl = `${base}/legal/${version}/terms-of-service`;
  const privacyUrl = `${base}/legal/${version}/privacy-policy`;
  const refundUrl = `${base}/legal/${version}/refund-policy`;

  return (
    `<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${BRAND.accent};">Documentos aceitos neste pedido</p>` +
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;color:${BRAND.muted};">
       <li><a href="${escapeHtml(termsUrl)}" style="color:${BRAND.accent};">Termos de serviço</a></li>
       <li><a href="${escapeHtml(privacyUrl)}" style="color:${BRAND.accent};">Política de privacidade</a></li>
       <li><a href="${escapeHtml(refundUrl)}" style="color:${BRAND.accent};">Política de reembolso</a></li>
     </ul>` +
    notice('Estes links levam à versão exata que você aceitou nesta compra — mesmo que os documentos sejam revisados depois, o conteúdo aqui não muda.')
  );
}

function legalAcceptanceLines(acceptance: LegalAcceptance | null | undefined): string[] {
  if (!acceptance) return [];
  const version = encodeURIComponent(acceptance.version);
  const base = siteUrl();
  return [
    '',
    'Documentos aceitos neste pedido:',
    `Termos de serviço: ${base}/legal/${version}/terms-of-service`,
    `Política de privacidade: ${base}/legal/${version}/privacy-policy`,
    `Política de reembolso: ${base}/legal/${version}/refund-policy`,
  ];
}

export function orderCreatedEmail(order: OrderSummary): RenderedEmail {
  const subject = `Pedido ${order.reference} criado`;
  return {
    subject,
    html: renderLayout({
      title: 'Recebemos seu pedido',
      preheader: `Pedido ${order.reference} aguardando pagamento.`,
      body:
        paragraph('Seu pedido foi registrado e está aguardando a confirmação do pagamento.') +
        detailsTable(baseRows(order)) +
        legalAcceptanceBlock(order.legalAcceptance),
    }),
    text: renderText([
      'Recebemos seu pedido.',
      `Pedido: ${order.reference}`,
      `Produto: ${order.productName}`,
      `Valor: ${formatMoney(order.amountCents, order.currency)}`,
      ...legalAcceptanceLines(order.legalAcceptance),
    ]),
  };
}

// ------------------------------------------------------------- Pix criado --

export type PixEmailInput = OrderSummary & {
  pixCode: string;
  expiresAt: string | null;
};

export function pixCreatedEmail(input: PixEmailInput): RenderedEmail {
  return {
    subject: `Pix gerado — pedido ${input.reference}`,
    html: renderLayout({
      title: 'Seu Pix está pronto',
      preheader: `Pague ${formatMoney(input.amountCents, input.currency)} via Pix para liberar seu pedido.`,
      body:
        paragraph('Copie o código abaixo e cole na opção <strong style="color:' + BRAND.text + ';">Pix Copia e Cola</strong> do seu banco.') +
        codeBlock(input.pixCode, { accent: true }) +
        detailsTable(baseRows(input, [{ label: 'Válido até', value: formatDate(input.expiresAt) }])) +
        notice('A liberação é automática assim que o banco confirmar o pagamento. Não é necessário enviar comprovante.'),
    }),
    text: renderText([
      'Seu Pix está pronto.',
      `Pedido: ${input.reference}`,
      `Valor: ${formatMoney(input.amountCents, input.currency)}`,
      `Válido até: ${formatDate(input.expiresAt)}`,
      '',
      'Pix Copia e Cola:',
      input.pixCode,
    ]),
  };
}

// ---------------------------------------------------------- boleto criado --

export type BoletoEmailInput = OrderSummary & {
  digitableLine: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
};

export function boletoCreatedEmail(input: BoletoEmailInput): RenderedEmail {
  return {
    subject: `Boleto gerado — pedido ${input.reference}`,
    html: renderLayout({
      title: 'Seu boleto foi gerado',
      preheader: `Boleto de ${formatMoney(input.amountCents, input.currency)} aguardando pagamento.`,
      body:
        paragraph('Pague o boleto pelo aplicativo do seu banco usando a linha digitável abaixo.') +
        (input.digitableLine ? codeBlock(input.digitableLine) : '') +
        (input.ticketUrl ? button('Visualizar boleto', input.ticketUrl) : '') +
        detailsTable(baseRows(input, [{ label: 'Vencimento', value: formatDate(input.expiresAt) }])) +
        notice('A compensação bancária do boleto leva até 3 dias úteis. A liberação acontece automaticamente depois disso.'),
    }),
    text: renderText([
      'Seu boleto foi gerado.',
      `Pedido: ${input.reference}`,
      `Valor: ${formatMoney(input.amountCents, input.currency)}`,
      `Vencimento: ${formatDate(input.expiresAt)}`,
      input.digitableLine ? `Linha digitável: ${input.digitableLine}` : null,
      input.ticketUrl ? `Boleto: ${input.ticketUrl}` : null,
    ]),
  };
}

// ------------------------------------------------- pagamento aprovado FMM --

export type FmmLicenseEmailInput = OrderSummary & {
  planName: string;
  licenseKey: string;
  expiresAt: string | null;
  isLifetime: boolean;
  downloadUrl: string;
  keysUrl: string;
};

export function fmmLicenseEmail(input: FmmLicenseEmailInput): RenderedEmail {
  const validity = input.isLifetime ? 'Vitalícia' : formatDate(input.expiresAt);
  return {
    subject: 'FMM — Pagamento aprovado e sua chave',
    html: renderLayout({
      title: 'Pagamento aprovado',
      preheader: `Sua chave do FMM (${input.planName}) está pronta.`,
      body:
        paragraph(`Seu pagamento foi confirmado e a licença do <strong style="color:${BRAND.text};">FiveM Mod Manager — ${escapeHtml(input.planName)}</strong> já está ativa.`) +
        `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1px;">Sua chave de licença</p>` +
        codeBlock(input.licenseKey, { accent: true }) +
        button('Baixar FMM', input.downloadUrl) +
        detailsTable(baseRows(input, [{ label: 'Validade', value: validity }])) +
        `<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${BRAND.accent};">Como ativar</p>
         <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:${BRAND.muted};">
           <li>Baixe e abra o FiveM Mod Manager.</li>
           <li>Vá em <span style="color:${BRAND.text};">Configurações → Ativar Licença</span>.</li>
           <li>Cole a chave acima e confirme.</li>
         </ol>` +
        notice(`A chave também fica salva na sua conta: <a href="${escapeHtml(input.keysUrl)}" style="color:${BRAND.accent};">Minhas Chaves</a>. Este e-mail não é o único lugar onde ela existe.`),
    }),
    text: renderText([
      'Pagamento aprovado — sua chave do FMM',
      `Plano: ${input.planName}`,
      `Pedido: ${input.reference}`,
      `Valor: ${formatMoney(input.amountCents, input.currency)}`,
      `Validade: ${validity}`,
      '',
      `Chave de licença: ${input.licenseKey}`,
      '',
      `Download: ${input.downloadUrl}`,
      `Minhas chaves: ${input.keysUrl}`,
      '',
      'Como ativar: abra o FMM, vá em Configurações > Ativar Licença e cole a chave.',
    ]),
  };
}

// ------------------------------------------------- pagamento aprovado (genérico) --

export function paymentApprovedEmail(order: OrderSummary): RenderedEmail {
  return {
    subject: `Pagamento aprovado — pedido ${order.reference}`,
    html: renderLayout({
      title: 'Pagamento aprovado',
      preheader: `Pedido ${order.reference} confirmado.`,
      body:
        paragraph('Seu pagamento foi confirmado.') +
        detailsTable(baseRows(order)) +
        legalAcceptanceBlock(order.legalAcceptance),
    }),
    text: renderText([
      'Pagamento aprovado.',
      `Pedido: ${order.reference}`,
      `Valor: ${formatMoney(order.amountCents, order.currency)}`,
      ...legalAcceptanceLines(order.legalAcceptance),
    ]),
  };
}

// -------------------------------------------------------- pagamento recusado --

export function paymentDeclinedEmail(order: OrderSummary): RenderedEmail {
  return {
    subject: `Pagamento não aprovado — pedido ${order.reference}`,
    html: renderLayout({
      title: 'Pagamento não aprovado',
      preheader: 'O banco emissor não autorizou a cobrança.',
      body:
        // Sem detalhe interno: o motivo real fica no log/auditoria.
        paragraph('O banco emissor não autorizou esta cobrança. Nenhum valor foi debitado.') +
        detailsTable(baseRows(order)) +
        paragraph('Você pode tentar novamente com outro cartão, ou usar Pix e boleto na mesma página do pedido.'),
    }),
    text: renderText([
      'Pagamento não aprovado.',
      `Pedido: ${order.reference}`,
      'Nenhum valor foi debitado. Tente outro cartão, Pix ou boleto.',
    ]),
  };
}

export function paymentExpiredEmail(order: OrderSummary): RenderedEmail {
  return {
    subject: `Pagamento expirado — pedido ${order.reference}`,
    html: renderLayout({
      title: 'O prazo de pagamento expirou',
      preheader: `Pedido ${order.reference} expirado.`,
      body:
        paragraph('O prazo para pagar este pedido terminou e ele foi encerrado. Nenhum valor foi cobrado.') +
        detailsTable(baseRows(order)) +
        paragraph('Se ainda quiser concluir a compra, basta iniciar um novo pedido.'),
    }),
    text: renderText(['O prazo de pagamento expirou.', `Pedido: ${order.reference}`]),
  };
}

export function paymentCancelledEmail(order: OrderSummary): RenderedEmail {
  return {
    subject: `Pedido ${order.reference} cancelado`,
    html: renderLayout({
      title: 'Pedido cancelado',
      preheader: `Pedido ${order.reference} cancelado.`,
      body: paragraph('Este pedido foi cancelado e nenhum valor será cobrado.') + detailsTable(baseRows(order)),
    }),
    text: renderText(['Pedido cancelado.', `Pedido: ${order.reference}`]),
  };
}

// ----------------------------------------------------------------- refund --

export type RefundEmailInput = OrderSummary & { refundedCents: number; partial: boolean };

export function refundEmail(input: RefundEmailInput): RenderedEmail {
  const title = input.partial ? 'Reembolso parcial processado' : 'Reembolso processado';
  return {
    subject: `${title} — pedido ${input.reference}`,
    html: renderLayout({
      title,
      preheader: `${formatMoney(input.refundedCents, input.currency)} devolvidos.`,
      body:
        paragraph(`Processamos o reembolso de <strong style="color:${BRAND.text};">${formatMoney(input.refundedCents, input.currency)}</strong>.`) +
        detailsTable(baseRows(input, [{ label: 'Valor reembolsado', value: formatMoney(input.refundedCents, input.currency) }])) +
        paragraph('O prazo de crédito depende do seu banco: até 2 dias úteis no Pix e até 2 faturas no cartão.'),
    }),
    text: renderText([
      title,
      `Pedido: ${input.reference}`,
      `Reembolsado: ${formatMoney(input.refundedCents, input.currency)}`,
    ]),
  };
}

export function chargebackEmail(order: OrderSummary): RenderedEmail {
  return {
    subject: `Contestação recebida — pedido ${order.reference}`,
    html: renderLayout({
      title: 'Recebemos uma contestação',
      preheader: `Pedido ${order.reference} em contestação.`,
      body:
        paragraph('O emissor do cartão abriu uma contestação para esta compra. Enquanto ela é analisada, o acesso ao produto fica suspenso.') +
        detailsTable(baseRows(order)) +
        paragraph('Se a contestação foi um engano, responda a este e-mail e resolvemos com você.'),
    }),
    text: renderText([
      'Recebemos uma contestação para esta compra; o acesso fica suspenso durante a análise.',
      `Pedido: ${order.reference}`,
    ]),
  };
}

// ------------------------------------------------------------ assinaturas --

export type SubscriptionEmailInput = OrderSummary & {
  intervalLabel: string;
  nextBillingDate: string | null;
};

export function subscriptionCreatedEmail(input: SubscriptionEmailInput): RenderedEmail {
  return {
    subject: `Renovação automática ativada — ${input.productName}`,
    html: renderLayout({
      title: 'Renovação automática ativada',
      preheader: `Cobrança ${input.intervalLabel} de ${formatMoney(input.amountCents, input.currency)}.`,
      body:
        paragraph(`Sua assinatura está ativa. A cobrança é ${escapeHtml(input.intervalLabel)} e você pode cancelar quando quiser — o cancelamento não apaga sua licença nem o histórico.`) +
        detailsTable(baseRows(input, [{ label: 'Próxima cobrança', value: formatDate(input.nextBillingDate) }])),
    }),
    text: renderText([
      'Renovação automática ativada.',
      `Produto: ${input.productName}`,
      `Cobrança: ${input.intervalLabel} de ${formatMoney(input.amountCents, input.currency)}`,
      `Próxima cobrança: ${formatDate(input.nextBillingDate)}`,
    ]),
  };
}

export type RenewalEmailInput = SubscriptionEmailInput & { newExpiresAt: string | null };

export function renewalApprovedEmail(input: RenewalEmailInput): RenderedEmail {
  return {
    subject: `Renovação aprovada — ${input.productName}`,
    html: renderLayout({
      title: 'Renovação aprovada',
      preheader: 'Sua licença foi estendida.',
      body:
        paragraph('A cobrança da renovação foi aprovada e sua licença foi estendida automaticamente. A chave continua a mesma.') +
        detailsTable(
          baseRows(input, [
            { label: 'Nova validade', value: formatDate(input.newExpiresAt) },
            { label: 'Próxima cobrança', value: formatDate(input.nextBillingDate) },
          ]),
        ),
    }),
    text: renderText([
      'Renovação aprovada — sua licença foi estendida.',
      `Produto: ${input.productName}`,
      `Nova validade: ${formatDate(input.newExpiresAt)}`,
    ]),
  };
}

export function renewalFailedEmail(input: SubscriptionEmailInput): RenderedEmail {
  return {
    subject: `Não conseguimos renovar — ${input.productName}`,
    html: renderLayout({
      title: 'A renovação não foi aprovada',
      preheader: 'Atualize seu cartão para manter o acesso.',
      body:
        paragraph('A cobrança da renovação não foi autorizada pelo banco emissor. Vamos tentar novamente nos próximos dias.') +
        detailsTable(baseRows(input)) +
        notice('Sua licença continua válida até a data de expiração atual. Para não perder o acesso, atualize o cartão antes disso.', 'danger'),
    }),
    text: renderText([
      'A renovação não foi aprovada.',
      `Produto: ${input.productName}`,
      'Sua licença continua válida até a expiração atual. Atualize o cartão para manter o acesso.',
    ]),
  };
}

export function subscriptionCancelledEmail(input: SubscriptionEmailInput): RenderedEmail {
  return {
    subject: `Renovação automática cancelada — ${input.productName}`,
    html: renderLayout({
      title: 'Renovação automática cancelada',
      preheader: 'Nenhuma cobrança futura será feita.',
      body:
        paragraph('A renovação automática foi cancelada e nenhuma nova cobrança será feita.') +
        detailsTable(baseRows(input)) +
        notice('Sua licença atual continua válida até a data de expiração — o cancelamento não revoga nada nem apaga o histórico.'),
    }),
    text: renderText([
      'Renovação automática cancelada.',
      `Produto: ${input.productName}`,
      'Sua licença continua válida até a data de expiração.',
    ]),
  };
}

// ------------------------------------------------- pedido de reembolso -----

/**
 * Confirmação IMEDIATA do recebimento do pedido de reembolso — obrigação
 * legal (Decreto 7.962/2013), não cortesia.
 *
 * O corpo vem do DESFECHO, nunca de um booleano: com `automatic: boolean`,
 * `reconciliation_required` caía no corpo do `manual` e afirmava ao cliente
 * que a licença seguia ativa e que nenhum estorno fora feito — justamente o
 * desfecho em que o dinheiro pode ter se movido. Um quarto desfecho também
 * não cai em corpo alheio: o `switch` é exaustivo e o compilador cobra o caso
 * novo (`never`).
 *
 * - `refunded`: o estorno foi solicitado ao Mercado Pago e a licença foi revogada.
 * - `manual` (fora da janela do Art. 49): nada se moveu, a licença segue ativa
 *   e o caso vai para análise — nenhum reembolso é prometido.
 * - `reconciliation_required`: o estorno foi PEDIDO e a conclusão está sendo
 *   confirmada com o Mercado Pago. Não afirma que a licença continua ativa
 *   nem que nenhum estorno foi feito — nenhuma das duas coisas é sabida aqui.
 */
export type RefundRequestedOutcome = 'refunded' | 'manual' | 'reconciliation_required';

export function refundRequestedEmail(input: {
  reference: string;
  outcome: RefundRequestedOutcome;
}): RenderedEmail {
  const reference = escapeHtml(input.reference);
  const received = `Confirmamos que recebemos seu pedido de reembolso do pedido <strong style="color:${BRAND.text};">${reference}</strong>.`;
  const receivedText = `Confirmamos que recebemos seu pedido de reembolso do pedido ${input.reference}.`;

  let body: string;
  let lines: string[];
  switch (input.outcome) {
    case 'refunded':
      body = paragraph(received) +
        paragraph('O estorno foi solicitado ao Mercado Pago. O prazo até o valor aparecer para você depende do meio de pagamento usado na compra.') +
        notice('A licença correspondente a este pedido foi revogada.', 'danger');
      lines = [
        receivedText,
        'O estorno foi solicitado ao Mercado Pago. O prazo depende do meio de pagamento usado na compra.',
        'A licença correspondente a este pedido foi revogada.',
      ];
      break;
    case 'manual':
      body = paragraph(received) +
        paragraph('Vamos analisar o seu caso e responder por este mesmo e-mail.') +
        notice('Sua licença continua ativa enquanto a análise não termina — nenhum estorno foi feito.');
      lines = [
        receivedText,
        'Vamos analisar o seu caso e responder por este mesmo e-mail.',
        'Sua licença continua ativa enquanto a análise não termina — nenhum estorno foi feito.',
      ];
      break;
    case 'reconciliation_required':
      body = paragraph(received) +
        paragraph('O estorno foi solicitado ao Mercado Pago e estamos confirmando a conclusão dele junto ao provedor. Assim que a confirmação chegar, avisamos por este mesmo e-mail.') +
        notice('Não é preciso pedir de novo: um segundo pedido pode duplicar a solicitação. Qualquer dúvida, basta responder a este e-mail.');
      lines = [
        receivedText,
        'O estorno foi solicitado ao Mercado Pago e estamos confirmando a conclusão dele junto ao provedor. Assim que a confirmação chegar, avisamos por este mesmo e-mail.',
        'Não é preciso pedir de novo: um segundo pedido pode duplicar a solicitação. Qualquer dúvida, basta responder a este e-mail.',
      ];
      break;
    default: {
      // Desfecho novo sem corpo próprio não compila — foi o silêncio do
      // booleano que fez `reconciliation_required` herdar o corpo do `manual`.
      const exhaustive: never = input.outcome;
      throw new Error(`desfecho de reembolso sem corpo próprio: ${String(exhaustive)}`);
    }
  }

  return {
    subject: `Recebemos seu pedido de reembolso — ${input.reference}`,
    html: renderLayout({
      title: 'Recebemos seu pedido de reembolso',
      preheader: `Pedido ${input.reference}: confirmamos o recebimento do seu pedido de reembolso.`,
      body,
    }),
    text: renderText(lines),
  };
}

// --------------------------------------------- alerta interno de reembolso --

/** Únicos dois desfechos que acionam o financeiro — `refunded` e `rejected` nunca chegam aqui. */
export type RefundAlertOutcome = 'manual' | 'reconciliation_required';

/**
 * Aviso ao FINANCEIRO — nunca ao cliente. `reconciliation_required` é o
 * único desfecho em que o dinheiro pode já ter se movido no Mercado Pago
 * enquanto o registro local diverge disso: por isso ganha assunto e corpo
 * próprios, urgentes, que não podem depender de alguém rolar log de
 * container para notar. `manual` é o caminho de rotina (fora da janela do
 * Art. 49) e usa um tom correspondente.
 */
export function refundAlertEmail(input: {
  reference: string;
  orderId: string;
  outcome: RefundAlertOutcome;
  detail: string | null;
}): RenderedEmail {
  const reference = escapeHtml(input.reference);
  const orderId = escapeHtml(input.orderId);
  const urgent = input.outcome === 'reconciliation_required';

  const subject = urgent
    ? `[URGENTE] Estorno pode ter sido feito e o registro diverge — pedido ${input.reference}`
    : `Reembolso aguardando análise manual — pedido ${input.reference}`;

  const body = urgent
    ? paragraph(`O estorno do pedido <strong style="color:${BRAND.text};">${reference}</strong> (id ${orderId}) pode ter sido aceito pelo Mercado Pago, mas o nosso registro local não confirma isso.`) +
      notice('Concilie manualmente com o extrato do Mercado Pago antes de tentar estornar de novo — repetir agora arrisca duplicar a devolução.', 'danger') +
      (input.detail ? codeBlock(input.detail) : '')
    : paragraph(`O pedido <strong style="color:${BRAND.text};">${reference}</strong> (id ${orderId}) está fora da janela automática de reembolso e aguarda análise manual.`) +
      (input.detail ? codeBlock(input.detail) : '');

  return {
    subject,
    html: renderLayout({
      title: urgent ? 'Divergência de estorno' : 'Reembolso para análise manual',
      preheader: subject,
      body,
    }),
    text: renderText([subject, `Pedido: ${input.reference} (${input.orderId})`, input.detail]),
  };
}
