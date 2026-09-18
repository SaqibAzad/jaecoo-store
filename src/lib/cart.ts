import { cookies } from "next/headers";
import { db, getSettings } from "./db";
import { depositFor, type Paisa } from "./money";

/**
 * The cart lives in a cookie as a list of {variantId, quantity}.
 *
 * Prices are never stored in the cookie — they are looked up fresh on every
 * read. A cookie is client-controlled, so a stored price would be a way for
 * anyone to set their own. Quantities are clamped on read for the same reason.
 */

const COOKIE = "jaecoo_cart";
const MAX_QTY = 99;
const MAX_LINES = 50;

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CartItem {
  variantId: string;
  productSlug: string;
  title: string;
  variantName: string;
  imagePath: string | null;
  unitPricePaisa: Paisa;
  quantity: number;
  linePaisa: Paisa;
}

export interface Cart {
  items: CartItem[];
  count: number;
  totalPaisa: Paisa;
  depositPaisa: Paisa;
  depositPercent: number;
}

function parse(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => typeof l?.variantId === "string" && Number.isFinite(l?.quantity))
      .map((l) => ({
        variantId: l.variantId,
        quantity: Math.min(MAX_QTY, Math.max(1, Math.floor(l.quantity))),
      }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export async function readLines(): Promise<CartLine[]> {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value);
}

export async function writeLines(lines: CartLine[]) {
  const jar = await cookies();
  const clean = lines.filter((l) => l.quantity > 0).slice(0, MAX_LINES);
  if (clean.length === 0) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, JSON.stringify(clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Resolve the cookie into real products at today's prices. */
export async function getCart(): Promise<Cart> {
  const lines = await readLines();
  const settings = await getSettings();

  if (lines.length === 0) {
    return { items: [], count: 0, totalPaisa: 0, depositPaisa: 0, depositPercent: settings.depositPercent };
  }

  const variants = await db.variant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: {
      image: true,
      product: {
        include: { images: { where: { kind: "GALLERY" }, orderBy: { position: "asc" }, take: 1 } },
      },
    },
  });

  const items: CartItem[] = [];
  for (const line of lines) {
    const v = variants.find((x) => x.id === line.variantId);
    // A variant that has been deleted or unpublished simply drops out of the
    // cart rather than breaking the page.
    if (!v || v.product.status !== "PUBLISHED") continue;
    items.push({
      variantId: v.id,
      productSlug: v.product.slug,
      title: v.product.title,
      variantName: v.name,
      imagePath: v.image?.path ?? v.product.images[0]?.path ?? null,
      unitPricePaisa: v.pricePaisa,
      quantity: line.quantity,
      linePaisa: v.pricePaisa * line.quantity,
    });
  }

  const totalPaisa = items.reduce((s, i) => s + i.linePaisa, 0);
  return {
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    totalPaisa,
    depositPaisa: depositFor(totalPaisa, settings.depositPercent),
    depositPercent: settings.depositPercent,
  };
}

export async function cartCount(): Promise<number> {
  const lines = await readLines();
  return lines.reduce((s, l) => s + l.quantity, 0);
}
