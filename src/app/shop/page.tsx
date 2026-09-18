import { getProducts, getModelsWithCounts } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";

export const metadata = { title: "All accessories" };

/**
 * Rebuilt at most once a minute. Product pages are generated at build time, so
 * without this a listing published from the admin would not appear on the site
 * until the next deploy.
 */
export const revalidate = 60;

export default async function ShopPage() {
  const [products, models] = await Promise.all([getProducts(), getModelsWithCounts()]);

  return (
    <div className="px-5 pt-8 lg:px-12 lg:pt-10">
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <span className="cut-sm label flex items-center bg-ink px-4 py-2 text-[13px] text-white">
          All
        </span>
        {models.map((m) => (
          <Link
            key={m.slug}
            href={`/shop/${m.slug}`}
            className="cut-sm label flex items-center border border-line bg-surface px-4 py-2 text-[13px] text-body hover:border-ink hover:text-ink"
          >
            {m.name}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="font-mark text-[20px] text-ink lg:text-[28px]">ALL ACCESSORIES</h1>
        <span className="label text-[11px] text-muted">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      {products.length === 0 ? (
        <EmptyShelf />
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

function EmptyShelf() {
  return (
    <div className="cut border border-line bg-surface p-10 text-center">
      <p className="text-[15px] text-body">Nothing published yet.</p>
      <p className="mt-1 text-[13.5px] text-muted">
        Import a listing from the admin and publish it to see it here.
      </p>
    </div>
  );
}
