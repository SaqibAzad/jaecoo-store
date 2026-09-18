import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testDb, resetDb, seedSettings, seedKeyCover } from "./helpers/db";
import {
  createOrder, transition, recordPayment, verifyPayment,
  orderBalance, needsBalance, OrderError,
} from "@/lib/orders";
import { IllegalTransition } from "@/lib/order-state";
import { formatPkr } from "@/lib/money";

let variants: Awaited<ReturnType<typeof seedKeyCover>>["variants"];

beforeEach(async () => {
  await resetDb();
  await seedSettings();
  ({ variants } = await seedKeyCover());
});

afterAll(async () => {
  await testDb.$disconnect();
});

const customer = {
  customerName: "A. Raza",
  phone: "03001234567",
  addressLine: "12 Shahrah-e-Faisal",
  city: "Karachi",
};

describe("createOrder", () => {
  it("totals the lines and opens awaiting deposit", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[1].id, quantity: 2 }], // Rs 2,730 each
      customer,
      plan: "PARTIAL",
    });

    expect(order.state).toBe("AWAITING_DEPOSIT");
    expect(formatPkr(order.totalPaisa)).toBe("Rs 5,460");
    expect(formatPkr(order.depositPaisa)).toBe("Rs 1,638"); // 30%
    expect(order.paidPaisa).toBe(0);
    expect(order.number).toMatch(/^JA-\d+$/);
  });

  it("asks for the full amount when the plan is FULL", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[0].id, quantity: 1 }],
      customer,
      plan: "FULL",
    });
    expect(order.depositPaisa).toBe(order.totalPaisa);
    expect(formatPkr(order.depositPaisa)).toBe("Rs 2,317");
  });

  it("gives consecutive orders distinct numbers", async () => {
    const a = await createOrder(testDb, { lines: [{ variantId: variants[0].id, quantity: 1 }], customer, plan: "FULL" });
    const b = await createOrder(testDb, { lines: [{ variantId: variants[0].id, quantity: 1 }], customer, plan: "FULL" });
    expect(a.number).not.toBe(b.number);
    expect(b.seq).toBeGreaterThan(a.seq);
  });

  it("snapshots price and title, so later edits cannot rewrite history", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[0].id, quantity: 1 }],
      customer,
      plan: "FULL",
    });

    // the shop owner re-prices and renames the variant afterwards
    await testDb.variant.update({
      where: { id: variants[0].id },
      data: { pricePaisa: 999900, name: "Renamed" },
    });

    const item = await testDb.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(formatPkr(item.unitPricePaisa)).toBe("Rs 2,317");
    expect(item.variantSnapshot).toBe("Shell only");
    const fresh = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(formatPkr(fresh.totalPaisa)).toBe("Rs 2,317");
  });

  it("survives the product being deleted afterwards", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[0].id, quantity: 1 }],
      customer,
      plan: "FULL",
    });
    await testDb.product.deleteMany({});
    const item = await testDb.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.titleSnapshot).toContain("Key Cover");
    expect(item.variantId).toBeNull(); // SetNull, not a cascade delete
  });

  it("refuses an empty order", async () => {
    await expect(createOrder(testDb, { lines: [], customer, plan: "FULL" })).rejects.toThrow(OrderError);
  });

  it("refuses a zero or fractional quantity", async () => {
    for (const quantity of [0, -1, 1.5]) {
      await expect(
        createOrder(testDb, { lines: [{ variantId: variants[0].id, quantity }], customer, plan: "FULL" })
      ).rejects.toThrow(OrderError);
    }
  });

  it("refuses a variant that does not exist", async () => {
    await expect(
      createOrder(testDb, { lines: [{ variantId: "nope", quantity: 1 }], customer, plan: "FULL" })
    ).rejects.toThrow(OrderError);
  });

  it("writes an opening event", async () => {
    const order = await createOrder(testDb, { lines: [{ variantId: variants[0].id, quantity: 1 }], customer, plan: "FULL" });
    const events = await testDb.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].from).toBeNull();
    expect(events[0].to).toBe("AWAITING_DEPOSIT");
  });
});

describe("payments", () => {
  async function partialOrder() {
    return createOrder(testDb, {
      lines: [{ variantId: variants[1].id, quantity: 2 }], // Rs 5,460, deposit Rs 1,638
      customer,
      plan: "PARTIAL",
    });
  }

  it("an unverified payment moves nothing", async () => {
    const order = await partialOrder();
    await recordPayment(testDb, {
      orderId: order.id, kind: "DEPOSIT", method: "BANK_TRANSFER", amountPaisa: 163800,
    });

    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.state).toBe("AWAITING_DEPOSIT");
    expect(after.paidPaisa).toBe(0);
  });

  it("verifying the deposit advances the order", async () => {
    const order = await partialOrder();
    const p = await recordPayment(testDb, {
      orderId: order.id, kind: "DEPOSIT", method: "JAZZCASH", amountPaisa: 163800, reference: "JC-88213",
    });

    const { order: after, advancedTo } = await verifyPayment(testDb, p.id, { actor: "saqib" });
    expect(advancedTo).toBe("DEPOSIT_PAID");
    expect(after.state).toBe("DEPOSIT_PAID");
    expect(formatPkr(after.paidPaisa)).toBe("Rs 1,638");
    expect(formatPkr(orderBalance(after))).toBe("Rs 3,822");
    expect(needsBalance(after)).toBe(true);
  });

  it("does not advance on a short payment", async () => {
    const order = await partialOrder();
    const p = await recordPayment(testDb, {
      orderId: order.id, kind: "DEPOSIT", method: "BANK_TRANSFER", amountPaisa: 100000, // under the 1,638 deposit
    });
    const { order: after, advancedTo } = await verifyPayment(testDb, p.id);
    expect(advancedTo).toBeNull();
    expect(after.state).toBe("AWAITING_DEPOSIT");
    expect(formatPkr(after.paidPaisa)).toBe("Rs 1,000");
  });

  it("adds up several part-payments until the deposit is met", async () => {
    const order = await partialOrder();
    const a = await recordPayment(testDb, { orderId: order.id, kind: "DEPOSIT", method: "EASYPAISA", amountPaisa: 80000 });
    const b = await recordPayment(testDb, { orderId: order.id, kind: "DEPOSIT", method: "EASYPAISA", amountPaisa: 90000 });

    expect((await verifyPayment(testDb, a.id)).advancedTo).toBeNull();
    const second = await verifyPayment(testDb, b.id);
    expect(second.advancedTo).toBe("DEPOSIT_PAID");
    expect(formatPkr(second.order.paidPaisa)).toBe("Rs 1,700");
  });

  it("refuses to verify the same payment twice", async () => {
    const order = await partialOrder();
    const p = await recordPayment(testDb, { orderId: order.id, kind: "DEPOSIT", method: "CARD", amountPaisa: 163800 });
    await verifyPayment(testDb, p.id);
    await expect(verifyPayment(testDb, p.id)).rejects.toThrow(OrderError);
  });

  it("refuses a zero or negative payment", async () => {
    const order = await partialOrder();
    for (const amountPaisa of [0, -500]) {
      await expect(
        recordPayment(testDb, { orderId: order.id, kind: "DEPOSIT", method: "CARD", amountPaisa })
      ).rejects.toThrow(OrderError);
    }
  });

  it("a fully prepaid order clears its balance in one payment", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[0].id, quantity: 1 }], customer, plan: "FULL",
    });
    const p = await recordPayment(testDb, {
      orderId: order.id, kind: "FULL", method: "BANK_TRANSFER", amountPaisa: order.totalPaisa,
    });
    const { order: after, advancedTo } = await verifyPayment(testDb, p.id);
    expect(advancedTo).toBe("DEPOSIT_PAID");
    expect(orderBalance(after)).toBe(0);
    expect(needsBalance(after)).toBe(false);
  });
});

describe("transitions", () => {
  async function paidOrder() {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[1].id, quantity: 2 }], customer, plan: "PARTIAL",
    });
    const p = await recordPayment(testDb, {
      orderId: order.id, kind: "DEPOSIT", method: "BANK_TRANSFER", amountPaisa: order.depositPaisa,
    });
    return (await verifyPayment(testDb, p.id)).order;
  }

  it("walks the whole lifecycle and records every step", async () => {
    let order = await paidOrder();
    order = await transition(testDb, order.id, "ORDERED_FROM_SUPPLIER", { note: "1688 order 8841", actor: "saqib" });
    order = await transition(testDb, order.id, "IN_TRANSIT", { actor: "saqib" });
    order = await transition(testDb, order.id, "BALANCE_DUE", { actor: "saqib" });
    order = await transition(testDb, order.id, "DISPATCHED", { actor: "saqib" });

    expect(order.state).toBe("DISPATCHED");
    expect(order.dispatchedAt).toBeInstanceOf(Date);

    const events = await testDb.orderEvent.findMany({
      where: { orderId: order.id }, orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.to)).toEqual([
      "AWAITING_DEPOSIT", "DEPOSIT_PAID", "ORDERED_FROM_SUPPLIER",
      "IN_TRANSIT", "BALANCE_DUE", "DISPATCHED",
    ]);
    expect(events.find((e) => e.to === "ORDERED_FROM_SUPPLIER")?.note).toBe("1688 order 8841");
  });

  it("refuses an illegal jump", async () => {
    const order = await paidOrder();
    await expect(transition(testDb, order.id, "DISPATCHED")).rejects.toThrow(IllegalTransition);
  });

  it("leaves the order untouched when a transition is refused", async () => {
    const order = await paidOrder();
    await expect(transition(testDb, order.id, "DISPATCHED")).rejects.toThrow();

    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.state).toBe("DEPOSIT_PAID");
    const events = await testDb.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events.map((e) => e.to)).not.toContain("DISPATCHED");
  });

  it("stamps dispatchedAt only on dispatch", async () => {
    let order = await paidOrder();
    expect(order.dispatchedAt).toBeNull();
    order = await transition(testDb, order.id, "ORDERED_FROM_SUPPLIER");
    expect(order.dispatchedAt).toBeNull();
  });
});

describe("deleting an order", () => {
  it("takes its items, payments and events with it", async () => {
    const order = await createOrder(testDb, {
      lines: [{ variantId: variants[0].id, quantity: 1 }], customer, plan: "FULL",
    });
    await recordPayment(testDb, { orderId: order.id, kind: "FULL", method: "CARD", amountPaisa: 100 });

    await testDb.order.delete({ where: { id: order.id } });

    expect(await testDb.orderItem.count()).toBe(0);
    expect(await testDb.payment.count()).toBe(0);
    expect(await testDb.orderEvent.count()).toBe(0);
  });
});
