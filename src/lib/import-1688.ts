"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { db, getSettings } from "./db";
import { sellPriceFromCost } from "./money";

const run = promisify(execFile);

const DOWNLOADS = join(homedir(), "Downloads", "1688");
const DL_SCRIPT = join(homedir(), "1688-dl", "dl1688.py");
const PUBLIC_DIR = join(process.cwd(), "public", "products");

export interface ImportedVariant {
  name: string;
  nameZh: string;
  costFen: number;
  pricePaisa: number;
  stock: number;
  supplierSku: string | null;
  photo: string | null;
}

export interface ImportPreview {
  offerId: string;
  titleZh: string;
  suggestedTitle: string;
  sourceUrl: string;
  moq: number | null;
  gallery: string[];
  description: string[];
  variants: ImportedVariant[];
  alreadyImported: boolean;
  warnings: string[];
}

function sha(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function findDownload(offerId: string): string | null {
  if (!existsSync(DOWNLOADS)) return null;
  const hit = readdirSync(DOWNLOADS).find((d) => d.startsWith(offerId));
  return hit ? join(DOWNLOADS, hit) : null;
}

function offerIdFrom(text: string): string | null {
  const m = text.match(/(?:offer\/|offerId=|^)(\d{9,16})/);
  return m ? m[1] : null;
}

/**
 * Run the dl1688 downloader for a link.
 *
 * The downloader owns everything 1688-specific — the TLS quirks, share-link
 * resolution, retry behaviour — so the admin shells out to it rather than
 * reimplementing any of that here.
 */
export async function fetchListing(url: string): Promise<{ offerId: string; log: string }> {
  if (!existsSync(DL_SCRIPT)) {
    throw new Error(
      `The dl1688 downloader was not found at ${DL_SCRIPT}. ` +
        `This import runs on the machine where the downloader is installed.`
    );
  }
  const { stdout, stderr } = await run("python3", [DL_SCRIPT, url, "--rate"], {
    timeout: 5 * 60 * 1000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const log = `${stdout}\n${stderr}`.trim();

  const offerId = (log.match(/offer (\d{9,16})/) ?? [])[1] ?? offerIdFrom(url);
  if (!offerId) throw new Error(`Could not work out which offer was downloaded.\n\n${log}`);
  return { offerId, log };
}

/** Read a completed download off disk and shape it for review. */
export async function buildPreview(offerId: string): Promise<ImportPreview> {
  const dir = findDownload(offerId);
  if (!dir) throw new Error(`No download found for offer ${offerId}.`);

  const manifest = JSON.parse(readFileSync(join(dir, "product.json"), "utf8"));
  const settings = await getSettings();
  const warnings: string[] = [];

  const list = (sub: string) => {
    const from = join(dir, sub);
    if (!existsSync(from)) return [] as string[];
    return readdirSync(from).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  };

  const galleryFiles = list("images");
  const skuFiles = list("sku");
  const descFiles = list("description");

  // Match variant photos BY NAME. dl1688 names sku files in the supplier's
  // order while variants arrive sorted by price, so matching positionally puts
  // the wrong photo on most variants.
  const skuByName = new Map<string, string>();
  for (const f of skuFiles) {
    const key = basename(f).replace(/^\d+\s*/, "").replace(/\.[^.]+$/, "").trim();
    skuByName.set(key, f);
  }

  const variants: ImportedVariant[] = (manifest.variants ?? []).map(
    (v: { name: string; price_cny: number; stock: number | null; sku_id: number | null }) => {
      const costFen = Math.round(v.price_cny * 100);
      const photo = skuByName.get(v.name.split(">")[0].trim()) ?? null;
      if (!photo) warnings.push(`No photo matched the variant "${v.name}".`);
      return {
        name: v.name,
        nameZh: v.name,
        costFen,
        pricePaisa: sellPriceFromCost(costFen, settings),
        stock: v.stock ?? 0,
        supplierSku: v.sku_id ? String(v.sku_id) : null,
        photo,
      };
    }
  );

  if (variants.length === 0) warnings.push("This listing has no variants; it will import as a single item.");
  if (galleryFiles.length === 0) warnings.push("No gallery images were downloaded.");

  // A zero price means the supplier prices by quantity rather than by variant,
  // and the per-variant price came back empty. Publishing that would put the
  // item on sale for nothing, so it is surfaced rather than quietly imported.
  const zeroPriced = variants.filter((v) => v.costFen <= 0);
  if (zeroPriced.length > 0) {
    warnings.push(
      `${zeroPriced.length} variant(s) came back with no price — this listing probably ` +
        `prices by quantity. Set a price by hand before publishing.`
    );
  }

  const existing = await db.product.findUnique({ where: { offerId } });

  return {
    offerId,
    titleZh: manifest.title ?? "",
    suggestedTitle: manifest.title ?? offerId,
    sourceUrl: manifest.url ?? `https://detail.1688.com/offer/${offerId}.html`,
    moq: manifest.moq ? Number(manifest.moq) : null,
    gallery: galleryFiles.map((f) => `/products/${offerId}/images/${f}`),
    description: descFiles.map((f) => `/products/${offerId}/description/${f}`),
    variants,
    alreadyImported: Boolean(existing),
    warnings,
  };
}

interface CopiedFile {
  path: string;
  sha256: string;
  /** Original filename — the variant photo match is made on this. */
  file: string;
}

function copyInto(dir: string, offerId: string, sub: string): CopiedFile[] {
  const from = join(dir, sub);
  if (!existsSync(from)) return [];
  const dest = join(PUBLIC_DIR, offerId, sub);
  mkdirSync(dest, { recursive: true });
  return readdirSync(from)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()
    .map((f) => {
      copyFileSync(join(from, f), join(dest, f));
      return { path: `/products/${offerId}/${sub}/${f}`, sha256: sha(join(from, f)), file: f };
    });
}

export interface PublishInput {
  offerId: string;
  title: string;
  subtitle: string;
  descriptionMd: string;
  fitmentNote: string;
  modelSlug: string;
  categorySlug: string | null;
  publish: boolean;
  featured: boolean;
  variantNames: Record<string, string>;
  variantPrices: Record<string, number>;
}

/** Create (or replace) the product from a reviewed preview. */
export async function saveImport(input: PublishInput) {
  const dir = findDownload(input.offerId);
  if (!dir) throw new Error(`No download found for offer ${input.offerId}.`);

  const manifest = JSON.parse(readFileSync(join(dir, "product.json"), "utf8"));
  const model = await db.vehicleModel.findUniqueOrThrow({ where: { slug: input.modelSlug } });
  const category = input.categorySlug
    ? await db.category.findUnique({ where: { slug: input.categorySlug } })
    : null;

  const slug =
    input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
    `offer-${input.offerId}`;

  await db.product.deleteMany({ where: { offerId: input.offerId } });

  const product = await db.product.create({
    data: {
      slug,
      status: input.publish ? "PUBLISHED" : "DRAFT",
      title: input.title,
      subtitle: input.subtitle || null,
      descriptionMd: input.descriptionMd || null,
      fitmentNote: input.fitmentNote || null,
      titleZh: manifest.title ?? null,
      offerId: input.offerId,
      sourceUrl: manifest.url ?? null,
      supplierMoq: manifest.moq ? Number(manifest.moq) : null,
      modelId: model.id,
      categoryId: category?.id ?? null,
      featured: input.featured,
      publishedAt: input.publish ? new Date() : null,
    },
  });

  const gallery = copyInto(dir, input.offerId, "images");
  const skus = copyInto(dir, input.offerId, "sku");
  const descs = copyInto(dir, input.offerId, "description");

  const madeGallery = await Promise.all(
    gallery.map((g, i) =>
      db.image.create({
        data: {
          productId: product.id,
          kind: "GALLERY",
          path: g.path,
          sha256: g.sha256,
          position: i,
          alt: input.title,
        },
      })
    )
  );

  // Variant photos on 1688 are usually byte-identical copies of gallery
  // photos; reuse the row so the thumbnail strip does not show duplicates.
  const byHash = new Map(madeGallery.map((g) => [g.sha256!, g]));
  const skuRows = new Map<string, (typeof madeGallery)[number]>();
  for (const [i, s] of skus.entries()) {
    const existing = byHash.get(s.sha256);
    const row =
      existing ??
      (await db.image.create({
        data: {
          productId: product.id,
          kind: "VARIANT",
          path: s.path,
          sha256: s.sha256,
          position: madeGallery.length + i,
        },
      }));
    byHash.set(s.sha256, row);
    const key = basename(s.file).replace(/^\d+\s*/, "").replace(/\.[^.]+$/, "").trim();
    skuRows.set(key, row);
  }

  await Promise.all(
    descs.map((d, i) =>
      db.image.create({
        data: {
          productId: product.id,
          kind: "DESCRIPTION",
          path: d.path,
          sha256: d.sha256,
          position: i,
        },
      })
    )
  );

  const rawVariants = (manifest.variants ?? []) as Array<{
    name: string;
    price_cny: number;
    stock: number | null;
    sku_id: number | null;
  }>;

  // Refuse to publish anything priced at zero, whatever the admin submitted.
  if (input.publish) {
    const bad = Object.entries(input.variantPrices).filter(([, p]) => !p || p <= 0);
    if (bad.length > 0) {
      throw new Error(
        `Cannot publish: ${bad.length} variant(s) have no selling price. ` +
          `Set a price for every variant, or save as a draft instead.`
      );
    }
  }

  for (const [i, v] of rawVariants.entries()) {
    const costFen = Math.round(v.price_cny * 100);
    await db.variant.create({
      data: {
        productId: product.id,
        name: input.variantNames[v.name] || v.name,
        nameZh: v.name,
        sku: `${input.offerId}-${i + 1}`,
        supplierSku: v.sku_id ? String(v.sku_id) : null,
        costFen,
        pricePaisa: input.variantPrices[v.name] ?? 0,
        stock: v.stock ?? 0,
        position: i,
        imageId: skuRows.get(v.name.split(">")[0].trim())?.id ?? null,
      },
    });
  }

  return product;
}
