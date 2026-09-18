"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/auth";

async function requireAdmin() {
  if (!(await currentAdmin())) throw new Error("Not signed in.");
}

function refresh(slug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function setStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  await requireAdmin();
  const p = await db.product.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : null },
  });
  refresh(p.slug);
}

export async function toggleFeatured(id: string, featured: boolean) {
  await requireAdmin();
  const p = await db.product.update({ where: { id }, data: { featured } });
  refresh(p.slug);
}

export async function updateVariantPrice(variantId: string, pricePaisa: number) {
  await requireAdmin();
  if (!Number.isFinite(pricePaisa) || pricePaisa < 0) throw new Error("Invalid price.");
  const v = await db.variant.update({
    where: { id: variantId },
    data: { pricePaisa },
    include: { product: { select: { slug: true } } },
  });
  refresh(v.product.slug);
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const p = await db.product.delete({ where: { id } });
  refresh(p.slug);
}
