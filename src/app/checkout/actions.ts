"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/orders";
import { readLines, writeLines } from "@/lib/cart";

export async function placeOrder(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const lines = await readLines();
  if (lines.length === 0) redirect("/cart");

  const plan = get("plan") === "PARTIAL" ? "PARTIAL" : "FULL";
  const customer = {
    customerName: get("customerName"),
    phone: get("phone"),
    email: get("email") || null,
    addressLine: get("addressLine"),
    city: get("city"),
    postcode: get("postcode") || null,
    notes: get("notes") || null,
  };

  if (!customer.customerName || !customer.phone || !customer.addressLine || !customer.city) {
    redirect("/checkout?error=missing");
  }

  let number: string;
  try {
    const order = await createOrder(db, { lines, customer, plan });
    number = order.number;
  } catch {
    redirect("/checkout?error=failed");
  }

  await writeLines([]); // the cart is now an order
  redirect(`/order/${number}`);
}
