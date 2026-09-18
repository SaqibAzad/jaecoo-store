"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readLines, writeLines } from "@/lib/cart";

export async function addToCart(variantId: string, quantity: number) {
  const qty = Math.min(99, Math.max(1, Math.floor(quantity)));

  // Confirm the variant exists and is actually buyable before trusting it.
  const variant = await db.variant.findFirst({
    where: { id: variantId, product: { status: "PUBLISHED" } },
    select: { id: true },
  });
  if (!variant) return { ok: false as const, error: "That item is no longer available." };

  const lines = await readLines();
  const existing = lines.find((l) => l.variantId === variantId);
  if (existing) existing.quantity = Math.min(99, existing.quantity + qty);
  else lines.push({ variantId, quantity: qty });

  await writeLines(lines);
  revalidatePath("/cart");
  return { ok: true as const, count: lines.reduce((s, l) => s + l.quantity, 0) };
}

export async function setQuantity(variantId: string, quantity: number) {
  const lines = await readLines();
  const qty = Math.min(99, Math.floor(quantity));
  const next = qty <= 0
    ? lines.filter((l) => l.variantId !== variantId)
    : lines.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l));
  await writeLines(next);
  revalidatePath("/cart");
  return { ok: true as const };
}

export async function removeFromCart(variantId: string) {
  const lines = await readLines();
  await writeLines(lines.filter((l) => l.variantId !== variantId));
  revalidatePath("/cart");
  return { ok: true as const };
}
