"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/auth";
import { transition, recordPayment, verifyPayment } from "@/lib/orders";
import type { OrderState } from "@/lib/order-state";
import type { PaymentKind, PaymentMethod } from "@prisma/client";

async function admin() {
  const a = await currentAdmin();
  if (!a) throw new Error("Not signed in.");
  return a;
}

export async function moveOrder(orderId: string, to: OrderState, note?: string) {
  const a = await admin();
  try {
    await transition(db, orderId, to, { note, actor: a.email });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addPayment(input: {
  orderId: string; kind: PaymentKind; method: PaymentMethod; amountRupees: number; reference?: string;
}) {
  await admin();
  try {
    await recordPayment(db, {
      orderId: input.orderId,
      kind: input.kind,
      method: input.method,
      amountPaisa: Math.round(input.amountRupees * 100),
      reference: input.reference || null,
    });
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function approvePayment(paymentId: string, orderId: string) {
  const a = await admin();
  try {
    const { advancedTo } = await verifyPayment(db, paymentId, { actor: a.email });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true as const, advancedTo };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectPayment(paymentId: string, orderId: string, note: string) {
  await admin();
  await db.payment.update({
    where: { id: paymentId },
    data: { status: "REJECTED", reviewNote: note || null },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true as const };
}
