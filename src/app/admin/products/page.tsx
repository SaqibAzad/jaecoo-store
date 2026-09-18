import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { formatPkr, formatCny } from "@/lib/money";
import { PageHead, Empty, Pill } from "@/components/admin-ui";
import { ProductRowControls } from "@/components/product-row-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const products = await db.product.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
    include: {
      model: true,
      variants: { orderBy: { position: "asc" } },
      images: { where: { kind: "GALLERY" }, orderBy: { position: "asc" }, take: 1 },
    },
  });

  return (
    <>
      <PageHead
        title="Products"
        subtitle={`${products.length} total`}
        action={
          <Link href="/admin/import" className="cut-sm label bg-ink px-5 py-2.5 text-[12.5px] font-bold text-white">
            Import from 1688
          </Link>
        }
      />
      <div className="p-5 lg:p-7">
        {products.length === 0 ? (
          <Empty title="No products yet." hint="Import your first listing from 1688." href="/admin/import" cta="Import a product" />
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((p) => {
              const lo = Math.min(...p.variants.map((v) => v.pricePaisa));
              const hi = Math.max(...p.variants.map((v) => v.pricePaisa));
              const cost = Math.min(...p.variants.map((v) => v.costFen));
              return (
                <div key={p.id} className="flex flex-col gap-3 border border-line bg-surface p-4 sm:flex-row">
                  <div className="relative h-24 w-24 shrink-0 border border-line bg-sunk">
                    {p.images[0] && <Image src={p.images[0].path} alt="" fill sizes="96px" className="object-cover" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Pill tone={p.status === "PUBLISHED" ? "good" : p.status === "DRAFT" ? "warn" : "neutral"}>
                        {p.status.toLowerCase()}
                      </Pill>
                      {p.featured && <Pill tone="info">bestseller</Pill>}
                      <span className="label text-[10.5px] text-muted">{p.model.name}</span>
                    </div>
                    <span className="text-[15px] font-medium text-ink">{p.title}</span>
                    <span className="tnum font-tech text-[13.5px] text-muted">
                      cost from {formatCny(cost)} · sells {lo === hi ? formatPkr(lo) : `${formatPkr(lo)} – ${formatPkr(hi)}`} · {p.variants.length} variants
                    </span>
                    <ProductRowControls
                      id={p.id}
                      slug={p.slug}
                      status={p.status}
                      featured={p.featured}
                      variants={p.variants.map((v) => ({ id: v.id, name: v.name, pricePaisa: v.pricePaisa, costFen: v.costFen }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
