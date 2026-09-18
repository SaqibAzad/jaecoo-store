/**
 * Order operations.
 *
 * Every write that changes `Order.state` goes through `transition`, which
 * checks the move is legal and records an OrderEvent in the same transaction.
 * Nothing else in the app may set `state` directly.
 */
import type { PrismaClient, Order, OrderState, PaymentKind, PaymentMethod } from "@prisma/client";
import { assertTransition } from "./order-state";
import { balanceOf, depositFor, type Paisa } from "./money";

type Db = PrismaClient;
/** Prisma's transaction client — same surface, minus the transaction methods. */
type Tx = Omit<Db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface LineInput {
  variantId: string;
  quantity: number;
}

export interface CustomerInput {
  customerName: string;
  phone: string;
  email?: string | null;
  addressLine: string;
  city: string;
  postcode?: string | null;
  notes?: string | null;
}

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/**
 * Place an order.
 *
 * Prices and titles are copied onto the line items rather than referenced, so
 * later edits to a product never rewrite an order that already exists.
 */
export async function createOrder(
  db: Db,
  input: {
    lines: LineInput[];
    customer: CustomerInput;
    plan: "FULL" | "PARTIAL";
  }
): Promise<Order> {
  if (input.lines.length === 0) throw new OrderError("An order needs at least one line.");
  for (const l of input.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) {
      throw new OrderError(`Quantity must be a positive whole number, got ${l.quantity}.`);
    }
  }

  const settings = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  const variants = await db.variant.findMany({
    where: { id: { in: input.lines.map((l) => l.variantId) } },
    include: { product: true },
  });
  if (variants.length !== new Set(input.lines.map((l) => l.variantId)).size) {
    throw new OrderError("One or more variants in this order no longer exist.");
  }

  const items = input.lines.map((line) => {
    const v = variants.find((x) => x.id === line.variantId)!;
    return {
      variantId: v.id,
      productId: v.productId,
      titleSnapshot: v.product.title,
      variantSnapshot: v.name,
      unitPricePaisa: v.pricePaisa,
      costFenSnapshot: v.costFen,
      quantity: line.quantity,
    };
  });

  const totalPaisa: Paisa = items.reduce((sum, i) => sum + i.unitPricePaisa * i.quantity, 0);
  const depositPaisa =
    input.plan === "FULL" ? totalPaisa : depositFor(totalPaisa, settings.depositPercent);

  return db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        number: "pending",
        plan: input.plan,
        state: "AWAITING_DEPOSIT",
        ...input.customer,
        totalPaisa,
        depositPaisa,
        items: { create: items },
      },
    });

    // seq is assigned by Postgres, so the number is unique even under load
    const order = await tx.order.update({
      where: { id: created.id },
      data: { number: `JA-${1000 + created.seq}` },
    });

    await tx.orderEvent.create({
      data: { orderId: order.id, from: null, to: "AWAITING_DEPOSIT", note: "Order placed", actor: "system" },
    });

    return order;
  });
}

/**
 * Move an order to a new state. Throws IllegalTransition if the move is not
 * allowed; the event row and the state change commit together or not at all.
 */
export async function transition(
  db: Db,
  orderId: string,
  to: OrderState,
  opts: { note?: string; actor?: string } = {}
): Promise<Order> {
  return db.$transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(current.state, to);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        state: to,
        ...(to === "DISPATCHED" ? { dispatchedAt: new Date() } : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        from: current.state,
        to,
        note: opts.note ?? null,
        actor: opts.actor ?? "system",
      },
    });

    return updated;
  });
}

/** Record that a customer says they have paid. Does not move the order on its own. */
export async function recordPayment(
  db: Db,
  input: {
    orderId: string;
    kind: PaymentKind;
    method: PaymentMethod;
    amountPaisa: Paisa;
    reference?: string | null;
    proofPath?: string | null;
  }
) {
  if (input.amountPaisa <= 0) throw new OrderError("A payment must be greater than zero.");
  await db.order.findUniqueOrThrow({ where: { id: input.orderId } });
  return db.payment.create({ data: { ...input, status: "PENDING_REVIEW" } });
}

/**
 * Verify a payment and advance the order if the money now allows it.
 *
 * `paidPaisa` only ever counts VERIFIED payments — an unverified claim must
 * never move an order or reduce a balance.
 */
export async function verifyPayment(
  db: Db,
  paymentId: string,
  opts: { actor?: string; note?: string } = {}
): Promise<{ order: Order; advancedTo: OrderState | null }> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === "VERIFIED") throw new OrderError("This payment is already verified.");

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "VERIFIED", verifiedAt: new Date(), reviewNote: opts.note ?? null },
    });

    const verified = await tx.payment.aggregate({
      where: { orderId: payment.orderId, status: "VERIFIED", kind: { not: "REFUND" } },
      _sum: { amountPaisa: true },
    });
    const paidPaisa = verified._sum.amountPaisa ?? 0;

    const order = await tx.order.update({
      where: { id: payment.orderId },
      data: { paidPaisa },
    });

    const advancedTo = await maybeAdvance(tx, order, opts.actor ?? "system");
    const fresh = advancedTo
      ? await tx.order.findUniqueOrThrow({ where: { id: order.id } })
      : order;

    return { order: fresh, advancedTo };
  });
}

/**
 * The one place money decides state.
 *
 * - enough for the deposit, and we are waiting on it -> DEPOSIT_PAID
 * - fully paid while the balance was outstanding     -> DISPATCHED is NOT
 *   automatic; the goods still have to be sent, so it stays BALANCE_DUE and
 *   the admin marks dispatch by hand.
 */
async function maybeAdvance(tx: Tx, order: Order, actor: string): Promise<OrderState | null> {
  if (order.state === "AWAITING_DEPOSIT" && order.paidPaisa >= order.depositPaisa) {
    assertTransition(order.state, "DEPOSIT_PAID");
    await tx.order.update({ where: { id: order.id }, data: { state: "DEPOSIT_PAID" } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        from: order.state,
        to: "DEPOSIT_PAID",
        note: "Payment verified",
        actor,
      },
    });
    return "DEPOSIT_PAID";
  }
  return null;
}

export function orderBalance(order: Pick<Order, "totalPaisa" | "paidPaisa">): Paisa {
  return balanceOf(order.totalPaisa, order.paidPaisa);
}

/** True when the customer still owes money before we can dispatch. */
export function needsBalance(order: Pick<Order, "totalPaisa" | "paidPaisa">): boolean {
  return orderBalance(order) > 0;
}
