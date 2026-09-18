import Link from "next/link";
import { db } from "@/lib/db";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const models = await db.vehicleModel.findMany({ orderBy: { position: "asc" } });

  return (
    <header>
      <div className="flex h-[34px] items-center justify-center bg-ink px-4 text-center">
        <span className="label text-[10px] text-white sm:text-[11px]">
          Free delivery on orders over Rs 5,000
        </span>
      </div>

      <div className="flex h-[68px] items-center justify-between gap-6 border-b border-line bg-surface px-5 lg:px-12">
        <div className="flex items-center gap-10">
          <Wordmark />
          <nav className="hidden items-center gap-7 lg:flex">
            {models.map((m) => (
              <Link
                key={m.id}
                href={`/shop/${m.slug}`}
                className="label text-[13px] text-muted transition-colors hover:text-ink"
              >
                {m.name}
              </Link>
            ))}
            <Link
              href="/shop"
              className="label text-[13px] text-ink transition-colors hover:text-muted"
            >
              All accessories
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <Link href="/shop" aria-label="Search" className="text-ink hover:text-muted">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </Link>
          <Link href="/cart" aria-label="Cart" className="text-ink hover:text-muted">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 7h12l-1 13H7L6 7z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
