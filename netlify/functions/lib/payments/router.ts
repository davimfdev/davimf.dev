/**
 * Roteador do módulo de pagamentos.
 *
 * Vive dentro do módulo (e não espalhado em handlers soltos) justamente para
 * que extrair `payments/` para um serviço separado no futuro seja mover a
 * pasta e apontar o proxy — Orders, Products e licenças não mudam.
 *
 * Rotas:
 *   GET  /api/payments/config
 *   GET  /api/payments/products?family=fmm
 *   POST /api/payments/checkout
 *   GET  /api/payments/orders
 *   GET  /api/payments/orders/:id
 *   POST /api/payments/pix
 *   POST /api/payments/card
 *   POST /api/payments/boleto
 *   POST /api/payments/subscription
 *   POST /api/payments/subscription/cancel
 *   GET  /api/payments/status?paymentId=...
 *   GET  /api/payments/licenses
 *   POST /api/payments/webhooks/mercadopago
 *   POST /api/payments/admin/refund
 */

import { getFmmLicenseService } from './application/FmmLicenseService';
import { getOrderService } from './application/OrderService';
import { getPaymentService } from './application/PaymentService';
import { getSubscriptionService } from './application/SubscriptionService';
import { FMM_DOWNLOAD_URL, mercadoPagoPublicKey } from './config';
import { ForbiddenError, ValidationError } from './domain/errors';
import type { Product } from './domain/types';
import {
  errorJson,
  headersOf,
  json,
  optionalInt,
  optionalString,
  originAllowed,
  parsePayer,
  readJson,
  rejectRawCardData,
  requireEmail,
  requireString,
  requireUser,
  toErrorResponse,
} from './http';
import { listSubscriptionsByUser } from './repositories/SubscriptionRepository';
import { paymentsEnv, providerName } from './providers/registry';
import { getWebhookService } from './webhooks/WebhookService';

/** Projeção pública do catálogo — preço em centavos, como o banco guarda. */
function publicProduct(product: Product) {
  return {
    code: product.code,
    family: product.family,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    currency: product.currency,
    isLifetime: product.isLifetime,
    recurringEligible: product.recurringEligible,
    recurringInterval: product.recurringInterval,
    recurringFrequency: product.recurringFrequency,
    durationDays: product.durationDays,
  };
}

function normalizePath(url: string): string {
  const pathname = new URL(url, 'https://davimf.dev').pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

// --------------------------------------------------------------- handlers --

async function handleConfig(): Promise<Response> {
  return json({
    provider: providerName(),
    environment: paymentsEnv(),
    // Public key é pública por definição; o access token nunca sai do servidor.
    publicKey: mercadoPagoPublicKey(),
    downloadUrl: FMM_DOWNLOAD_URL,
    methods: ['pix', 'card', 'boleto'],
  });
}

async function handleProducts(request: Request): Promise<Response> {
  const family = new URL(request.url, 'https://davimf.dev').searchParams.get('family') ?? undefined;
  const products = await getOrderService().listCatalog(family ?? undefined);
  return json({ products: products.map(publicProduct) });
}

async function handleCheckout(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const body = await readJson(request);
  rejectRawCardData(body);

  // Nenhum campo de valor é lido: só produto, quantidade e intenção.
  const created = await getOrderService().create({
    userId: user.id,
    userEmail: requireEmail(body),
    productCode: requireString(body, 'productCode', 80),
    quantity: optionalInt(body, 'quantity') ?? 1,
    autoRenew: body.autoRenew === true,
    idempotencyKey: optionalString(body, 'idempotencyKey', 120),
  });

  return json(
    {
      order: {
        id: created.order.id,
        reference: created.order.reference,
        status: created.order.status,
        amountCents: created.order.amountCents,
        currency: created.order.currency,
        autoRenew: created.order.autoRenew,
        productCode: created.order.productCode,
        productName: created.product.name,
      },
      product: publicProduct(created.product),
      reused: created.reused,
    },
    created.reused ? 200 : 201,
  );
}

type ChargeContext = Awaited<ReturnType<typeof loadChargeContext>>;

async function loadChargeContext(request: Request) {
  const user = await requireUser(request);
  const body = await readJson(request);
  rejectRawCardData(body);

  const orders = getOrderService();
  // Sessão manda: o pedido tem de ser DESTE usuário.
  const order = await orders.requireOwnedOrder(requireString(body, 'orderId', 64), user.id);
  const product = await orders.requireProduct(order.productCode);

  return { user, body, order, product, payer: parsePayer(body, order.userEmail) };
}

async function respondWithPayment(context: ChargeContext, view: Awaited<ReturnType<ReturnType<typeof getPaymentService>['createPix']>>) {
  return json({ payment: serializePayment(view), order: { id: context.order.id, reference: context.order.reference } }, 201);
}

function serializePayment(view: Awaited<ReturnType<ReturnType<typeof getPaymentService>['createPix']>>) {
  const display = (view.details.display ?? {}) as Record<string, unknown>;
  return {
    id: view.id,
    orderId: view.orderId,
    orderReference: view.orderReference,
    productName: view.productName,
    method: view.method,
    status: view.status,
    amountCents: view.amountCents,
    currency: view.currency,
    installments: view.installments,
    expiresAt: view.expiresAt,
    // Só campos de exibição — nada sensível.
    pix: view.method === 'pix'
      ? {
          qrCode: display.pixQrCode ?? null,
          qrCodeBase64: display.pixQrCodeBase64 ?? null,
          ticketUrl: display.ticketUrl ?? null,
        }
      : undefined,
    boleto: view.method === 'boleto'
      ? {
          digitableLine: display.boletoDigitableLine ?? null,
          barcode: display.boletoBarcode ?? null,
          ticketUrl: display.ticketUrl ?? null,
        }
      : undefined,
    card: view.method === 'card'
      ? { brand: display.cardBrand ?? null, lastFour: display.cardLastFour ?? null }
      : undefined,
    threeDsUrl: display.threeDsUrl ?? null,
    license: view.license,
    downloadUrl: view.downloadUrl,
  };
}

async function handlePix(request: Request): Promise<Response> {
  const context = await loadChargeContext(request);
  const view = await getPaymentService().createPix({
    order: context.order,
    product: context.product,
    payer: context.payer,
    idempotencyKey: optionalString(context.body, 'idempotencyKey', 120),
  });
  return respondWithPayment(context, view);
}

async function handleBoleto(request: Request): Promise<Response> {
  const context = await loadChargeContext(request);
  const view = await getPaymentService().createBoleto({
    order: context.order,
    product: context.product,
    payer: context.payer,
    idempotencyKey: optionalString(context.body, 'idempotencyKey', 120),
  });
  return respondWithPayment(context, view);
}

async function handleCard(request: Request): Promise<Response> {
  const context = await loadChargeContext(request);

  // `cardToken` é a ÚNICA referência de cartão aceita. PAN/CVV nunca chegam.
  const cardToken = requireString(context.body, 'cardToken', 200);
  const paymentMethodId = requireString(context.body, 'paymentMethodId', 40);
  const installments = optionalInt(context.body, 'installments') ?? 1;

  // Renovação automática vira assinatura, não cobrança avulsa.
  if (context.order.autoRenew) {
    const subscription = await getSubscriptionService().create({
      order: context.order,
      product: context.product,
      payer: context.payer,
      cardToken,
      idempotencyKey: optionalString(context.body, 'idempotencyKey', 120),
    });
    const payments = await getPaymentService().listForOrder(context.order.id);
    const latest = payments[0];
    const view = latest
      ? await getPaymentService().view(latest, await getOrderService().requireOrder(context.order.id), context.product)
      : null;
    return json(
      {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          nextBillingDate: subscription.nextBillingDate,
          autoRenew: subscription.autoRenew,
        },
        payment: view ? serializePayment(view) : null,
      },
      201,
    );
  }

  const view = await getPaymentService().createCard({
    order: context.order,
    product: context.product,
    payer: context.payer,
    cardToken,
    paymentMethodId,
    installments,
    idempotencyKey: optionalString(context.body, 'idempotencyKey', 120),
  });
  return respondWithPayment(context, view);
}

async function handleSubscription(request: Request): Promise<Response> {
  const context = await loadChargeContext(request);
  const subscription = await getSubscriptionService().create({
    order: context.order,
    product: context.product,
    payer: context.payer,
    cardToken: requireString(context.body, 'cardToken', 200),
    idempotencyKey: optionalString(context.body, 'idempotencyKey', 120),
  });
  return json({ subscription }, 201);
}

async function handleSubscriptionCancel(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const body = await readJson(request);
  const subscription = await getSubscriptionService().cancel(requireString(body, 'subscriptionId', 64), user.id);
  return json({ subscription });
}

async function handleSubscriptionList(request: Request): Promise<Response> {
  const user = await requireUser(request);
  return json({ subscriptions: await listSubscriptionsByUser(user.id) });
}

/**
 * Polling do checkout. Reconsulta o PROVIDER (nunca acredita no frontend).
 * Se confirmar o pagamento antes do webhook, envia a confirmação deduplicada.
 */
async function handleStatus(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const paymentId = new URL(request.url, 'https://davimf.dev').searchParams.get('paymentId');
  if (!paymentId) throw new ValidationError('paymentId é obrigatório.', 'FIELD_REQUIRED');

  const payments = getPaymentService();
  const payment = await payments.requirePayment(paymentId);
  // Não vaza pagamento de outro usuário.
  if (payment.userId !== user.id) throw new ValidationError('Pagamento não encontrado.', 'PAYMENT_NOT_FOUND');

  const view = await payments.reconcile(paymentId, 'polling');
  return json({ payment: serializePayment(view) });
}

async function handleOrders(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const orders = await getOrderService().listForUser(user.id);
  return json({ orders });
}

async function handleOrderById(request: Request, orderId: string): Promise<Response> {
  const user = await requireUser(request);
  const orders = getOrderService();
  const order = await orders.requireOwnedOrder(orderId, user.id);
  const product = await orders.requireProduct(order.productCode);
  const payments = await getPaymentService().listForOrder(order.id);

  const latest = payments[0]
    ? serializePayment(await getPaymentService().view(payments[0], order, product))
    : null;

  return json({
    order: {
      id: order.id,
      reference: order.reference,
      status: order.status,
      amountCents: order.amountCents,
      currency: order.currency,
      productCode: order.productCode,
      productName: product.name,
      autoRenew: order.autoRenew,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    },
    payment: latest,
  });
}

/** Painel do cliente: a chave continua recuperável fora do e-mail. */
async function handleLicenses(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const licenses = await getFmmLicenseService().listForUser(user.id);
  return json({
    downloadUrl: FMM_DOWNLOAD_URL,
    licenses: licenses.map(({ license, key }) => ({
      id: license.id,
      key,
      keyPrefix: license.keyPrefix,
      level: license.level,
      status: license.status,
      durationDays: license.durationDays,
      expiresAt: license.expiresAt,
      activatedAt: license.activatedAt,
      createdAt: license.createdAt,
      orderId: license.orderId,
    })),
  });
}

async function handleWebhook(request: Request): Promise<Response> {
  // Corpo CRU: o adaptador Express preserva os bytes, e a assinatura do
  // Mercado Pago é calculada sobre headers + query, não sobre o JSON parseado.
  const rawBody = await request.text();
  const outcome = await getWebhookService().handle({
    rawBody,
    headers: headersOf(request),
    url: request.url,
  });

  if (outcome.status === 401) return errorJson('INVALID_SIGNATURE', 'Assinatura inválida.', 401);
  if (outcome.status === 500) return errorJson('WEBHOOK_ERROR', 'Falha ao processar notificação.', 500);
  return json({ received: true, result: outcome.result });
}

async function handleRefund(request: Request): Promise<Response> {
  const user = await requireUser(request);
  // Permissão reutiliza a lista de suporte já existente no projeto.
  if (!user.isAdmin) throw new ForbiddenError('Ação restrita a administradores.', 'ADMIN_REQUIRED');

  const body = await readJson(request);
  const amountCents = optionalInt(body, 'amountCents');
  const view = await getPaymentService().refund(requireString(body, 'paymentId', 64), amountCents);
  return json({ payment: serializePayment(view) });
}

// ---------------------------------------------------------------- roteador --

type Route = { method: string; path: string; handler: (request: Request) => Promise<Response> };

const ROUTES: Route[] = [
  { method: 'GET', path: '/api/payments/config', handler: handleConfig },
  { method: 'GET', path: '/api/payments/products', handler: handleProducts },
  { method: 'POST', path: '/api/payments/checkout', handler: handleCheckout },
  { method: 'GET', path: '/api/payments/orders', handler: handleOrders },
  { method: 'POST', path: '/api/payments/pix', handler: handlePix },
  { method: 'POST', path: '/api/payments/card', handler: handleCard },
  { method: 'POST', path: '/api/payments/boleto', handler: handleBoleto },
  { method: 'POST', path: '/api/payments/subscription', handler: handleSubscription },
  { method: 'GET', path: '/api/payments/subscriptions', handler: handleSubscriptionList },
  { method: 'POST', path: '/api/payments/subscription/cancel', handler: handleSubscriptionCancel },
  { method: 'GET', path: '/api/payments/status', handler: handleStatus },
  { method: 'GET', path: '/api/payments/licenses', handler: handleLicenses },
  { method: 'POST', path: '/api/payments/webhooks/mercadopago', handler: handleWebhook },
  { method: 'POST', path: '/api/payments/admin/refund', handler: handleRefund },
];

/** Todos os caminhos expostos — consumido por server/src/routes/functions.ts. */
export const PAYMENTS_ROUTE_PATHS: string[] = [
  ...new Set(ROUTES.map((route) => route.path)),
  '/api/payments/orders/:orderId',
];

export async function routePaymentsRequest(request: Request): Promise<Response> {
  const path = normalizePath(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  // O webhook vem do Mercado Pago (sem Origin) e é autenticado por assinatura.
  const isWebhook = path === '/api/payments/webhooks/mercadopago';
  if (!isWebhook && !originAllowed(request)) {
    return errorJson('FORBIDDEN_ORIGIN', 'Origem não permitida.', 403);
  }

  try {
    const orderMatch = /^\/api\/payments\/orders\/([^/]+)$/.exec(path);
    if (orderMatch && method === 'GET') return await handleOrderById(request, decodeURIComponent(orderMatch[1]));

    const route = ROUTES.find((candidate) => candidate.path === path);
    if (!route) return errorJson('NOT_FOUND', `Rota ${method} ${path} não existe.`, 404);
    if (route.method !== method) return errorJson('METHOD_NOT_ALLOWED', 'Método não permitido.', 405);

    return await route.handler(request);
  } catch (error) {
    return toErrorResponse(error);
  }
}
