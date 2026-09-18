import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db, getSettings } from "@/lib/db";
import { depositFor } from "@/lib/money";
import { ProductBuy, type BuyVariant } from "@/components/product-buy";

export async function generateStaticParams() {
  const rows = await db.product.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return rows.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const p = await db.product.findUnique({
    where: { slug },
    select: { title: true, descriptionMd: true },
  });
  if (!p) return { title: "Not found" };
  return { title: p.title, description: p.descriptionMd ?? undefined };
}

/**
 * Rebuilt at most once a minute. Product pages are generated at build time, so
 * without this a listing published from the admin would not appear on the site
 * until the next deploy.
 */
export const revalidate = 60;

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;

  const [product, settings] = await Promise.all([
    db.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        model: true,
        variants: { orderBy: { position: "asc" }, include: { image: true } },
        images: { orderBy: { position: "asc" } },
      },
    }),
    getSettings(),
  ]);

  if (!product) notFound();

  // Gallery images first, then any variant photo that is genuinely its own
  // image rather than a duplicate of one already shown.
  const galleryImages = product.images.filter((i) => i.kind === "GALLERY");
  const extraVariantImages = product.images.filter(
    (i) => i.kind === "VARIANT" && !galleryImages.some((g) => g.id === i.id)
  );
  const shown = [...galleryImages, ...extraVariantImages];
  const gallery = shown.map((i) => i.path);
  const description = product.images.filter((i) => i.kind === "DESCRIPTION");

  const variants: BuyVariant[] = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    pricePaisa: v.pricePaisa,
    depositPaisa: depositFor(v.pricePaisa, settings.depositPercent),
    // Which photo to show when this finish is selected. -1 when the supplier
    // gave us no per-variant photo, in which case the gallery stays put.
    imageIndex: v.imageId ? shown.findIndex((i) => i.id === v.imageId) : -1,
  }));

  return (
    <div className="px-5 pt-6 lg:px-12 lg:pt-8">
      <nav className="label mb-5 text-[11px] text-muted">
        <Link href="/shop" className="hover:text-ink">
          Shop
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/shop/${product.model.slug}`} className="hover:text-ink">
          {product.model.name}
        </Link>
      </nav>

      <h1 className="font-tech text-[26px] font-bold leading-tight text-ink lg:text-[38px]">
        {product.title}
      </h1>
      {product.subtitle && (
        <div className="label mt-2 text-[11px] text-muted">{product.subtitle}</div>
      )}

      {/* Fitment sits above the buy controls deliberately: a wrong-key purchase
          is the single biggest cause of returns on these parts. */}
      {product.fitmentNote && (
        <div className="mt-5 flex items-start gap-4 border border-warn bg-warn-soft p-4 lg:items-center lg:p-5">
          {description[description.length - 1] && (
            <div className="relative aspect-square w-20 shrink-0 border border-warn-line bg-surface lg:w-[104px]">
              <Image
                src={description[description.length - 1].path}
                alt="The key this cover fits"
                fill
                sizes="104px"
                className="object-contain"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b5760f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 16H3l9-16z" />
                <path d="M12 9v5" />
                <path d="M12 17.5v.5" />
              </svg>
              <span className="label text-[14px] font-bold text-warn-deep lg:text-[17px]">
                Check your key first
              </span>
            </div>
            <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-[#6b5a3c]">
              {product.fitmentNote}
            </p>
          </div>
        </div>
      )}

      <div className="mt-7 lg:mt-9">
        <ProductBuy
          title={product.title}
          variants={variants}
          gallery={gallery}
          depositPercent={settings.depositPercent}
        />
      </div>

      <div className="mt-8 flex items-start gap-2.5 border-t border-line pt-5 lg:mt-10">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8c8f90" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <p className="text-[13.5px] leading-relaxed text-muted">
          Imported to order —{" "}
          <strong className="text-ink">
            {settings.leadTimeMinDays} to {settings.leadTimeMaxDays} days
          </strong>{" "}
          to your door. We order from our supplier the day your payment clears and send tracking
          when it ships.
        </p>
      </div>

      {product.descriptionMd && (
        <section className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-14">
          <div>
            <h2 className="label mb-2.5 text-[13px] text-ink">Details</h2>
            <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-body">
              {product.descriptionMd}
            </p>
          </div>
          <div>
            <h2 className="label mb-2.5 text-[13px] text-ink">Specification</h2>
            <dl className="text-[13.5px]">
              <Row label="Fits" value={`${product.model.name}${product.subtitle ? "" : ""}`} />
              {product.supplierMoq && <Row label="Sold as" value="Single unit" />}
              <Row label="Delivery" value={`${settings.leadTimeMinDays}–${settings.leadTimeMaxDays} days`} />
            </dl>
          </div>
        </section>
      )}

      {description.length > 1 && (
        <section className="mt-9">
          <h2 className="label mb-3 text-[13px] text-ink">From the maker</h2>
          <div className="mx-auto flex max-w-[790px] flex-col">
            {description.slice(0, -1).map((img) => (
              <div key={img.id} className="relative aspect-[790/600] w-full">
                <Image src={img.path} alt="" fill sizes="790px" className="object-contain" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
