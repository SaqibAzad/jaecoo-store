"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/auth";
import { fetchListing, buildPreview, saveImport, type PublishInput, type ImportPreview } from "@/lib/import-1688";

async function requireAdmin() {
  if (!(await currentAdmin())) throw new Error("Not signed in.");
}

export async function runImport(url: string): Promise<
  { ok: true; preview: ImportPreview; log: string } | { ok: false; error: string }
> {
  await requireAdmin();
  try {
    const { offerId, log } = await fetchListing(url);
    const preview = await buildPreview(offerId);
    return { ok: true, preview, log };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function publishImport(
  input: PublishInput
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const product = await saveImport(input);
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath(`/product/${product.slug}`);
    revalidatePath("/admin/products");
    return { ok: true, slug: product.slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
