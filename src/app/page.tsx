import Link from "next/link";
import { getFeatured, getModelsWithCounts } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import { getSettings } from "@/lib/db";

/**
 * Rebuilt at most once a minute. Product pages are generated at build time, so
 * without this a listing published from the admin would not appear on the site
 * until the next deploy.
 */
export const revalidate = 60;

export default async function HomePage() {
  const [featured, models, settings] = await Promise.all([
    getFeatured(5),
    getModelsWithCounts(),
    getSettings(),
  ]);

  return (
    <>
      {/* hero */}
      <section className="relative h-[460px] overflow-hidden bg-[linear-gradient(160deg,#23282b_0%,#14181a_48%,#0b0d0e_100%)] lg:h-[620px]">
        <div
          className="pointer-events-none absolute -left-8 top-8 select-none whitespace-nowrap font-mark text-[84px] leading-none text-white opacity-[0.045] lg:top-11 lg:text-[168px]"
          aria-hidden
        >
          JAECOO JAECOO
        </div>
        <div className="absolute left-5 top-5 h-6 w-9 border-l-2 border-t-2 border-white/55 lg:left-6 lg:top-6 lg:h-[34px] lg:w-14" aria-hidden />
        <div className="absolute right-5 top-5 h-6 w-9 border-r-2 border-t-2 border-white/55 lg:right-6 lg:top-6 lg:h-[34px] lg:w-14" aria-hidden />

        <div className="absolute inset-x-5 bottom-8 flex max-w-[620px] flex-col gap-4 lg:inset-x-auto lg:left-12 lg:bottom-32 lg:gap-5">
          <h1 className="font-mark text-[26px] leading-[1.25] text-white lg:text-[46px] lg:leading-[1.22]">
            UPGRADE
            <br />
            YOUR JAECOO
          </h1>
          <p className="max-w-[46ch] text-[14px] leading-relaxed text-[#c9cccd] lg:text-[15.5px]">
            Mats, covers, trim and protection — sourced direct, fitted to your model, delivered
            across Pakistan.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <Link
              href="/shop"
              className="cut label flex h-[50px] items-center justify-center gap-2.5 bg-white px-6 text-[13.5px] font-bold text-ink lg:h-[52px] lg:text-[14px]"
            >
              Shop accessories
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/fitment"
              className="cut label flex h-[50px] items-center justify-center border border-white/35 bg-white/[0.09] px-6 text-[13.5px] font-bold text-white lg:h-[52px] lg:text-[14px]"
            >
              Check fitment
            </Link>
          </div>
        </div>
      </section>

      {/* shop by model */}
      <section className="px-5 pt-10 lg:px-12 lg:pt-14">
        <div className="mb-5 flex items-baseline justify-between gap-5">
          <h2 className="font-mark text-[16px] text-ink lg:text-[22px]">SHOP BY MODEL</h2>
          <span className="label hidden text-[12px] text-muted sm:inline">Fitment guaranteed</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {models.map((m) => (
            <Link
              key={m.slug}
              href={`/shop/${m.slug}`}
              className="cut flex h-32 flex-col justify-between bg-[linear-gradient(155deg,#23282b_0%,#0f1214_100%)] p-4 lg:h-52 lg:p-5"
            >
              <span className="label text-[9px] text-muted lg:text-[10.5px]">{m.kind}</span>
              <div className="flex flex-col gap-1.5 lg:gap-2">
                <span className="font-mark text-[18px] text-white lg:text-[25px]">{m.name}</span>
                <span className="label text-[10.5px] text-[#c9cccd] lg:text-[11.5px]">
                  {m._count.products} {m._count.products === 1 ? "product" : "products"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* bestsellers */}
      {featured.length > 0 && (
        <section className="px-5 pt-10 lg:px-12 lg:pt-14">
          <div className="mb-5 flex items-baseline justify-between gap-5">
            <h2 className="font-mark text-[16px] text-ink lg:text-[22px]">BESTSELLERS</h2>
            <Link href="/shop" className="label border-b border-ink pb-0.5 text-[11px] text-ink lg:text-[12px]">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            {featured.map((p) => (
              <ProductCard key={p.slug} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* fitment strip */}
      <section className="px-5 pt-10 lg:px-12 lg:pt-14">
        <div className="cut flex flex-col gap-3.5 bg-ink p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:p-8">
          <div className="flex items-start gap-4 lg:items-center lg:gap-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 lg:h-[30px] lg:w-[30px]">
              <path d="M12 3l9 16H3l9-16z" />
              <path d="M12 9v5" />
              <path d="M12 17.5v.5" />
            </svg>
            <div className="flex flex-col gap-1">
              <span className="font-mark text-[14px] text-white lg:text-[17px]">NOT SURE IT FITS?</span>
              <span className="text-[13.5px] leading-relaxed text-inverse-muted lg:text-[14px]">
                Key covers and mats differ by trim and key type. Check yours in thirty seconds
                before you order.
              </span>
            </div>
          </div>
          <Link
            href="/fitment"
            className="cut-sm label flex h-11 shrink-0 items-center justify-center bg-white px-6 text-[12.5px] font-bold text-ink lg:h-[46px] lg:text-[13px]"
          >
            Fitment guide
          </Link>
        </div>
      </section>

      {/* delivery expectation — set once, prominently, to stop week-two refund requests */}
      <section className="px-5 pt-10 lg:px-12 lg:pt-14">
        <p className="mx-auto max-w-[70ch] text-center text-[14px] leading-relaxed text-muted">
          Everything is imported to order and reaches you in{" "}
          <strong className="text-ink">
            {settings.leadTimeMinDays}–{settings.leadTimeMaxDays} days
          </strong>
          . We order from our supplier the day your payment clears, and send tracking when it ships.
        </p>
      </section>
    </>
  );
}
