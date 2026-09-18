"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuantity, removeFromCart } from "@/app/cart/actions";
import { formatPkr } from "@/lib/money";
import type { CartItem } from "@/lib/cart";

export function CartLines({ items }: { items: CartItem[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex flex-col">
      {items.map((i) => (
        <div key={i.variantId} className="flex gap-4 border-b border-line py-4 first:pt-0">
          <Link href={`/product/${i.productSlug}`} className="relative h-24 w-24 shrink-0 border border-line bg-surface">
            {i.imagePath && <Image src={i.imagePath} alt="" fill sizes="96px" className="object-cover" />}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link href={`/product/${i.productSlug}`} className="text-[14.5px] font-medium text-ink hover:underline">
              {i.title}
            </Link>
            <span className="text-[13px] text-muted">{i.variantName}</span>
            <span className="tnum font-tech text-[13px] text-muted">{formatPkr(i.unitPricePaisa)} each</span>

            <div className="mt-1.5 flex items-center gap-3">
              <div className="flex items-center border border-line">
                <button type="button" aria-label="Decrease quantity" disabled={pending}
                  onClick={() => act(() => setQuantity(i.variantId, i.quantity - 1))}
                  className="flex h-9 w-9 items-center justify-center text-[18px] text-body hover:text-ink disabled:opacity-40">−</button>
                <span className="tnum w-8 text-center font-tech text-[14px] font-bold text-ink">{i.quantity}</span>
                <button type="button" aria-label="Increase quantity" disabled={pending}
                  onClick={() => act(() => setQuantity(i.variantId, i.quantity + 1))}
                  className="flex h-9 w-9 items-center justify-center text-[16px] text-body hover:text-ink disabled:opacity-40">+</button>
              </div>
              <button type="button" disabled={pending}
                onClick={() => act(() => removeFromCart(i.variantId))}
                className="label text-[11.5px] text-muted underline hover:text-danger disabled:opacity-40">Remove</button>
            </div>
          </div>

          <div className="tnum shrink-0 font-tech text-[15px] font-bold text-ink">{formatPkr(i.linePaisa)}</div>
        </div>
      ))}
    </div>
  );
}
