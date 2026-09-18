/**
 * Import a 1688 listing from the command line.
 *
 * Imports cannot run on Vercel: the downloader is a Python script on this
 * machine, and Vercel's filesystem is read-only at runtime so downloaded
 * images could not be written anyway. Run this locally instead — pointing
 * DATABASE_URL at production publishes straight to the live store.
 *
 *   npm run import -- "https://qr.1688.com/s/XXXX"
 *   npm run import -- "<url>" --model j7 --category interior --publish
 */
import "dotenv/config";
import { fetchListing, buildPreview, saveImport } from "../src/lib/import-1688";
import { formatPkr, formatCny } from "../src/lib/money";

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const url = process.argv[2];
  if (!url || url.startsWith("--")) {
    console.error('Usage: npm run import -- "<1688 url>" [--model j7] [--category interior] [--publish]');
    process.exit(1);
  }

  const target = process.env.DATABASE_URL?.includes("db.prisma.io") ? "PRODUCTION" : "local";
  console.log(`Importing into the ${target} database.\n`);

  console.log("Downloading from 1688…");
  const { offerId } = await fetchListing(url);

  const preview = await buildPreview(offerId);
  console.log(`\n${preview.titleZh}`);
  console.log(`offer ${preview.offerId} · ${preview.gallery.length} images · ${preview.variants.length} variants\n`);
  for (const v of preview.variants) {
    console.log(
      `  ${formatCny(v.costFen).padStart(8)} -> ${formatPkr(v.pricePaisa).padStart(10)}  ` +
        `${v.name.padEnd(30)} ${v.photo ?? "NO PHOTO"}`
    );
  }
  for (const w of preview.warnings) console.log(`\n  warning: ${w}`);

  const product = await saveImport({
    offerId: preview.offerId,
    title: arg("title", preview.suggestedTitle)!,
    subtitle: arg("subtitle", "")!,
    descriptionMd: arg("description", "")!,
    fitmentNote: arg("fitment", "")!,
    modelSlug: arg("model", "j7")!,
    categorySlug: arg("category", null as unknown as string) ?? null,
    publish: process.argv.includes("--publish"),
    featured: process.argv.includes("--featured"),
    variantNames: Object.fromEntries(preview.variants.map((v) => [v.nameZh, v.name])),
    variantPrices: Object.fromEntries(preview.variants.map((v) => [v.nameZh, v.pricePaisa])),
  });

  console.log(
    `\nSaved as ${product.status.toLowerCase()}: /product/${product.slug}` +
      (product.status === "DRAFT" ? "\nPublish it from Admin → Products when the copy is ready." : "")
  );
  console.log(
    target === "PRODUCTION"
      ? "\nImages were written to public/products — commit and push so the live site can serve them."
      : ""
  );
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
