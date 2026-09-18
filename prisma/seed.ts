/**
 * Seeds base data, then imports the real key-cover listing we downloaded with
 * dl1688 — so the database starts out holding genuine prices, variants and
 * images rather than invented ones.
 *
 *   npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import { sellPriceFromCost } from "../src/lib/money";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DOWNLOADS = join(homedir(), "Downloads", "1688");
const PUBLIC_DIR = join(process.cwd(), "public", "products");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Find the folder dl1688 wrote for a given offer id. */
function findDownload(offerId: string): string | null {
  if (!existsSync(DOWNLOADS)) return null;
  const hit = readdirSync(DOWNLOADS).find((d) => d.startsWith(offerId));
  return hit ? join(DOWNLOADS, hit) : null;
}

interface CopiedImage {
  path: string;
  sha256: string;
}

function copyImages(srcDir: string, offerId: string, sub: string): CopiedImage[] {
  const from = join(srcDir, sub);
  if (!existsSync(from)) return [];
  const dest = join(PUBLIC_DIR, offerId, sub);
  mkdirSync(dest, { recursive: true });
  return readdirSync(from)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()
    .map((f) => {
      const bytes = readFileSync(join(from, f));
      copyFileSync(join(from, f), join(dest, f));
      return {
        path: `/products/${offerId}/${sub}/${f}`,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
}

async function main() {
  const settings = await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log(
    `settings: ¥1 = Rs ${settings.cnyToPkr}, markup x${settings.markup}, deposit ${settings.depositPercent}%`
  );

  // --- vehicle models -----------------------------------------------------
  const models = [
    { slug: "j7", name: "J7", kind: "SUV · PHEV", position: 0 },
    { slug: "j5", name: "J5", kind: "Compact SUV", position: 1 },
    { slug: "c7", name: "C7", kind: "SUV", position: 2 },
    { slug: "omoda-5", name: "Omoda 5", kind: "Crossover", position: 3 },
  ];
  for (const m of models) {
    await db.vehicleModel.upsert({ where: { slug: m.slug }, update: m, create: m });
  }
  console.log(`vehicle models: ${models.map((m) => m.name).join(", ")}`);

  const categories = [
    { slug: "interior", name: "Interior", position: 0 },
    { slug: "exterior", name: "Exterior", position: 1 },
    { slug: "protection", name: "Protection", position: 2 },
  ];
  for (const c of categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  console.log(`categories: ${categories.map((c) => c.name).join(", ")}`);

  // --- the real key cover -------------------------------------------------
  const OFFER = "1057887564978";
  const dir = findDownload(OFFER);
  if (!dir) {
    console.log(
      `\nNo download found for offer ${OFFER} under ${DOWNLOADS}.\n` +
        `Run:  dl1688 "https://qr.1688.com/s/8zGKWTBn"\n` +
        `Base data is seeded; skipping the product.`
    );
    return;
  }

  const manifest = JSON.parse(readFileSync(join(dir, "product.json"), "utf8"));
  const j7 = await db.vehicleModel.findUniqueOrThrow({ where: { slug: "j7" } });
  const interior = await db.category.findUniqueOrThrow({ where: { slug: "interior" } });

  const title = "Jaecoo Key Cover — Black & White Gradient";
  const slug = slugify(title);

  await db.product.deleteMany({ where: { offerId: OFFER } }); // idempotent re-seed

  const product = await db.product.create({
    data: {
      slug,
      status: "PUBLISHED",
      title,
      subtitle: "L-type 4-button key · J7 / J5 / C7 / Omoda 5",
      titleZh: manifest.title,
      offerId: OFFER,
      sourceUrl: manifest.url,
      supplierMoq: manifest.moq ? Number(manifest.moq) : null,
      modelId: j7.id,
      categoryId: interior.id,
      featured: true,
      publishedAt: new Date(),
      fitmentNote:
        "Fits the L-type 4-button key only — unlock, lock, boot, remote start. " +
        "Jaecoo ships more than one key design, so compare yours with the photo before ordering.",
      descriptionMd:
        "A two-piece shell that clips over your key — no adhesive, no trimming. " +
        "The gradient finish keeps the button icons visible, and every cutout lines up so " +
        "locking, boot release and remote start work through the cover.",
    },
  });

  // images
  const gallery = copyImages(dir, OFFER, "images");
  const skuImgs = copyImages(dir, OFFER, "sku");
  const descImgs = copyImages(dir, OFFER, "description");

  const madeGallery = await Promise.all(
    gallery.map((img, i) =>
      db.image.create({
        data: {
          productId: product.id,
          kind: "GALLERY",
          path: img.path,
          sha256: img.sha256,
          position: i,
          alt: title,
        },
      })
    )
  );

  /**
   * 1688 ships each variant photo as a byte-identical copy of a gallery photo.
   * Storing both would duplicate every thumbnail, so a variant image that
   * matches a gallery image reuses that row; only genuinely new ones are added.
   */
  const byHash = new Map(madeGallery.map((g) => [g.sha256!, g]));
  const madeSku = await Promise.all(
    skuImgs.map(async (img, i) => {
      const existing = byHash.get(img.sha256);
      if (existing) return existing;
      const created = await db.image.create({
        data: {
          productId: product.id,
          kind: "VARIANT",
          path: img.path,
          sha256: img.sha256,
          position: madeGallery.length + i,
        },
      });
      byHash.set(img.sha256, created);
      return created;
    })
  );
  const reused = madeSku.filter((s) => s.kind === "GALLERY").length;

  /**
   * Match each variant to its photo BY NAME, never by position.
   *
   * dl1688 names variant files in the supplier's own order, while variants are
   * sorted by price — so the two lists do not line up. Matching positionally
   * put the white-strap photo on the round-buckle variant, which is exactly the
   * kind of error a customer only discovers after the parcel arrives.
   */
  const skuByName = new Map<string, (typeof madeSku)[number]>();
  skuImgs.forEach((img, i) => {
    const key = basename(img.path)
      .replace(/^\d+\s*/, "")       // strip the "01 " ordering prefix
      .replace(/\.[^.]+$/, "")       // strip the extension
      .trim();
    skuByName.set(key, madeSku[i]);
  });

  /** Variant names carry a ">标准" size suffix the filenames do not. */
  const imageForVariant = (nameZh: string) =>
    skuByName.get(nameZh.split(">")[0].trim()) ?? null;

  await Promise.all(
    descImgs.map((img, i) =>
      db.image.create({
        data: {
          productId: product.id,
          kind: "DESCRIPTION",
          path: img.path,
          sha256: img.sha256,
          position: i,
        },
      })
    )
  );

  // variants, priced by the x2 rule
  const english: Record<string, string> = {
    "奇瑞L款渐变黑白单壳>标准": "Shell only",
    "奇瑞L款渐变黑白单包+圆扣>标准": "Shell + round buckle",
    "奇瑞L款渐变黑白单包+金属扣>标准": "Shell + metal buckle",
    "奇瑞L款渐变黑白单包+白色皮绳扣>标准": "Shell + white leather strap",
    "奇瑞L款渐变黑白单包+黑色皮绳扣>标准": "Shell + black leather strap",
  };

  const variants = (manifest.variants ?? []) as Array<{
    name: string;
    price_cny: number;
    stock: number | null;
    sku_id: number | null;
  }>;

  for (const [i, v] of variants.entries()) {
    const costFen = Math.round(v.price_cny * 100);
    const name = english[v.name] ?? v.name;
    await db.variant.create({
      data: {
        productId: product.id,
        name,
        nameZh: v.name,
        sku: `${OFFER}-${i + 1}`,
        supplierSku: v.sku_id ? String(v.sku_id) : null,
        costFen,
        pricePaisa: sellPriceFromCost(costFen, settings),
        stock: v.stock ?? 0,
        position: i,
        imageId: imageForVariant(v.name)?.id ?? null,
      },
    });
  }

  const written = await db.variant.findMany({
    where: { productId: product.id },
    orderBy: { position: "asc" },
  });

  console.log(`\nproduct: ${product.title}`);
  console.log(
    `images: ${madeGallery.length} gallery, ${descImgs.length} description ` +
      `(${reused} variant photos reused an existing gallery image rather than duplicating it)`
  );
  const imagesById = new Map(
    (await db.image.findMany({ where: { productId: product.id } })).map((i) => [i.id, i])
  );
  let unmatched = 0;
  for (const v of written) {
    const img = v.imageId ? imagesById.get(v.imageId) : null;
    if (!img) unmatched++;
    console.log(
      `  ¥${(v.costFen / 100).toFixed(2).padStart(6)}  ->  Rs ${(v.pricePaisa / 100)
        .toLocaleString("en-US")
        .padStart(6)}   ${v.name.padEnd(28)} ${img ? basename(img.path) : "NO PHOTO"}`
    );
  }
  if (unmatched) console.log(`\n  warning: ${unmatched} variant(s) have no matching photo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
