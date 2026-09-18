import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getProducts, getModelsWithCounts } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";

export async function generateStaticParams() {
  const models = await db.vehicleModel.findMany({ select: { slug: true } });
  return models.map((m) => ({ model: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[model]">) {
  const { model } = await params;
  const row = await db.vehicleModel.findUnique({ where: { slug: model } });
  return { title: row ? `${row.name} accessories` : "Accessories" };
}

/**
 * Rebuilt at most once a minute. Product pages are generated at build time, so
 * without this a listing published from the admin would not appear on the site
 * until the next deploy.
 */
export const revalidate = 60;

export default async function ModelPage({ params }: PageProps<"/shop/[model]">) {
  // params is a Promise in Next 16 — synchronous access was removed.
  const { model } = await params;

  const [current, products, models] = await Promise.all([
    db.vehicleModel.findUnique({ where: { slug: model } }),
    getProducts({ modelSlug: model }),
    getModelsWithCounts(),
  ]);

  if (!current) notFound();

  return (
    <div className="px-5 pt-8 lg:px-12 lg:pt-10">
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <Link
          href="/shop"
          className="cut-sm label flex items-center border border-line bg-surface px-4 py-2 text-[13px] text-body hover:border-ink hover:text-ink"
        >
          All
        </Link>
        {models.map((m) => (
          <Link
            key={m.slug}
            href={`/shop/${m.slug}`}
            className={`cut-sm label flex items-center px-4 py-2 text-[13px] ${
              m.slug === model
                ? "bg-ink text-white"
                : "border border-line bg-surface text-body hover:border-ink hover:text-ink"
            }`}
          >
            {m.name}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="label text-[10.5px] text-muted">Shopping for</span>
          <h1 className="font-mark text-[20px] text-ink lg:text-[28px]">{current.name}</h1>
        </div>
        <span className="label text-[11px] text-muted">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="cut border border-line bg-surface p-10 text-center">
          <p className="text-[15px] text-body">No {current.name} accessories yet.</p>
          <Link href="/shop" className="mt-2 inline-block text-[13.5px] text-ink underline">
            See everything
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {products.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
