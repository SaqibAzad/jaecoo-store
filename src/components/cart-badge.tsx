"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Cart icon with a live count, fetched client-side to keep pages static. */
export function CartBadge() {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cart-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (!cancelled) setCount(d.count ?? 0); })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, [pathname]); // re-check after navigating, e.g. straight after adding

  return (
    <Link
      href="/cart"
      aria-label={count ? `Cart, ${count} items` : "Cart"}
      className="relative text-ink hover:text-muted"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 7h12l-1 13H7L6 7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {count !== null && count > 0 && (
        <span className="tnum absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-ink px-1 font-tech text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
