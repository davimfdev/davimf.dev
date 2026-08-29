/**
 * OrderService — dono do PEDIDO.
 *
 * Regra central: o BANCO determina o preço. O frontend manda produto,
 * quantidade e a intenção de renovar; nada mais. Qualquer `amount` que venha
 * do cliente é ignorado — não existe caminho de código que o leia.
 */

import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import { multiplyCents } from '../domain/money';
import type { Order, Product, VerifiedLegalAcceptance } from '../domain/types';
import {
  createOrder,
  findOrderById,
  findOrderByReference,
  listOrdersByUser,
  markOrderFulfilled,
  markOrderPaid,
  updateOrderStatus,
} from '../repositories/OrderRepository';
import { findProductByCode, listActiveProducts } from '../repositories/ProductRepository';

const MAX_QUANTITY = 10;

export type CreateOrderRequest = {
  userId: string;
  userEmail: string;
  productCode: string;
  quantity?: number;
  autoRenew?: boolean;
  /** Enviada pelo frontend; protege contra duplo clique/refresh/retry. */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  /**
   * Aceite dos documentos legais desta compra. Obrigatório: o router é quem
   * valida a versão e busca os hashes no nosso registro (`legal/versions`) —
   * aqui só chega o resultado já verificado, nunca o corpo cru do cliente.
   * O tipo `VerifiedLegalAcceptance` torna isso obrigatório em tempo de
   * compilação: só `requireLegalAcceptance` (router.ts) consegue produzir um.
   */
  legalAcceptance: VerifiedLegalAcceptance;
};

export type CreatedOrder = { order: Order; product: Product; reused: boolean };

export class OrderService {
  async listCatalog(family?: string): Promise<Product[]> {
    return listActiveProducts(family);
  }

  async requireProduct(code: string): Promise<Product> {
    const product = await findProductByCode(code);
    if (!product) throw new NotFoundError('Produto não encontrado.', 'PRODUCT_NOT_FOUND');
    if (!product.active) throw new ConflictError('Produto indisponível.', 'PRODUCT_INACTIVE');
    return product;
  }

  /**
   * Cria (ou recupera) o pedido.
   *
   * `reused` distingue "acabei de criar" de "essa chave já tinha pedido", o
   * que evita mandar o e-mail de pedido criado duas vezes.
   */
  async create(request: CreateOrderRequest): Promise<CreatedOrder> {
    if (!request.userId) throw new ValidationError('Usuário não identificado.', 'USER_REQUIRED');
    if (!request.userEmail) throw new ValidationError('E-mail é obrigatório.', 'EMAIL_REQUIRED');

    const quantity = request.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new ValidationError('Quantidade inválida.', 'INVALID_QUANTITY');
    }

    const product = await this.requireProduct(request.productCode);

    // Produto vitalício NUNCA tem recorrência — a regra vem do catálogo, não
    // de um `if` específico do FMM.
    const autoRenew = Boolean(request.autoRenew) && product.recurringEligible && !product.isLifetime;
    if (request.autoRenew && !autoRenew) {
      throw new ValidationError(
        'Este produto não permite renovação automática.',
        'RECURRING_NOT_ELIGIBLE',
      );
    }

    // O valor sai daqui e de mais lugar nenhum.
    const amountCents = multiplyCents(product.priceCents, quantity);

    const idempotencyKey = request.idempotencyKey?.trim() || randomUUID();
    const reference = `DVMF-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;

    const order = await createOrder({
      reference,
      userId: request.userId,
      userEmail: request.userEmail,
      productId: product.id,
      productCode: product.code,
      quantity,
      amountCents,
      currency: product.currency,
      autoRenew,
      idempotencyKey,
      metadata: { ...(request.metadata ?? {}), productName: product.name },
      legalAcceptance: request.legalAcceptance,
    });

    // O ON CONFLICT devolve a linha antiga: se a referência não é a que
    // acabamos de sortear, este pedido já existia.
    return { order, product, reused: order.reference !== reference };
  }

  async requireOrder(orderId: string): Promise<Order> {
    const order = await findOrderById(orderId);
    if (!order) throw new NotFoundError('Pedido não encontrado.', 'ORDER_NOT_FOUND');
    return order;
  }

  /** Nunca aceita userId vindo do corpo: a sessão manda. */
  async requireOwnedOrder(orderId: string, userId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.userId !== userId) {
      throw new NotFoundError('Pedido não encontrado.', 'ORDER_NOT_FOUND');
    }
    return order;
  }

  async findByReference(reference: string): Promise<Order | null> {
    return findOrderByReference(reference);
  }

  async listForUser(userId: string): Promise<Order[]> {
    return listOrdersByUser(userId);
  }

  /** `null` = já estava PAID; o caller deve tratar como evento repetido. */
  async markPaid(orderId: string, paidAt: string): Promise<Order | null> {
    return markOrderPaid(orderId, paidAt);
  }

  async updateStatus(orderId: string, status: Order['status']): Promise<Order | null> {
    if (status === 'PAID') {
      throw new ValidationError('Use markPaid para confirmar pagamento.', 'INVALID_TRANSITION');
    }
    return updateOrderStatus(orderId, status);
  }

  async markFulfilled(orderId: string): Promise<void> {
    await markOrderFulfilled(orderId);
  }
}

let cached: OrderService | null = null;

export function getOrderService(): OrderService {
  return (cached ??= new OrderService());
}

export function setOrderServiceForTesting(service: OrderService | null): void {
  cached = service;
}
