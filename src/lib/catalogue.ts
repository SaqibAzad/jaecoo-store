import { db } from "@/lib/db";
import type { CardProduct } from "@/components/product-card";

/** Shape a product row for the card, collapsing variants to a "from" price. */
export function toCard(p: {
  slug: string;
  title: string;
  subtitle: string | null;
  model: { name: string };
  variants: { pricePaisa: number }[];
  images: { path: string }[];
}): CardProduct {
  const prices = p.variants.map((v) => v.pricePaisa);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  return {
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    fitLabel: p.model.name,
    coverPath: p.images[0]?.path ?? null,
    fromPaisa: lo,
    hasRange: hi > lo,
  };
}

const CARD_SELECT = {
  slug: true,
  title: true,
  subtitle: true,
  model: { select: { name: true } },
  variants: { select: { pricePaisa: true } },
  images: {
    where: { kind: "GALLERY" as const },
    orderBy: { position: "asc" as const },
    take: 1,
    select: { path: true },
  },
};

export async function getFeatured(limit = 5) {
  const rows = await db.product.findMany({
    where: { status: "PUBLISHED", featured: true },
    orderBy: { position: "asc" },
    take: limit,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

export async function getProducts(opts: { modelSlug?: string } = {}) {
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(opts.modelSlug ? { model: { slug: opts.modelSlug } } : {}),
    },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

export async function getModelsWithCounts() {
  return db.vehicleModel.findMany({
    orderBy: { position: "asc" },
    select: {
      slug: true,
      name: true,
      kind: true,
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  });
}
