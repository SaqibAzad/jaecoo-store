import Link from "next/link";
import Image from "next/image";
import { getCart } from "@/lib/cart";
import { getSettings } from "@/lib/db";
import { formatPkr } from "@/lib/money";
import { CartLines } from "@/components/cart-lines";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getSettings()]);

  if (cart.items.length === 0) {
    return (
      <div className="px-5 py-16 text-center lg:px-12">
        <h1 className="font-mark text-[20px] text-ink">YOUR CART IS EMPTY</h1>
        <p className="mt-2 text-[14px] text-muted">Nothing added yet.</p>
        <Link href="/shop" className="cut label mt-6 inline-block bg-ink px-6 py-3 text-[13px] font-bold text-white">
          Shop accessories
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 lg:px-12 lg:pt-10">
      <h1 className="font-mark text-[20px] text-ink lg:text-[26px]">YOUR CART</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <CartLines items={cart.items} />

        <aside className="flex h-fit flex-col gap-3 border border-line bg-surface p-5">
          <h2 className="label text-[12.5px] text-ink">Summary</h2>

          <div className="flex justify-between gap-4 text-[14px]">
            <span className="text-muted">{cart.count} {cart.count === 1 ? "item" : "items"}</span>
            <span className="tnum font-tech font-bold text-ink">{formatPkr(cart.totalPaisa)}</span>
          </div>

          <div className="flex justify-between gap-4 border-t border-line-soft pt-3 text-[13.5px]">
            <span className="text-muted">Delivery</span>
            <span className="text-ink">
              {cart.totalPaisa >= settings.freeDeliveryOverPaisa ? "Free" : "Calculated at checkout"}
            </span>
          </div>

          <div className="mt-1 border border-ink p-3">
            <div className="label text-[10px] text-ink">Or reserve with {cart.depositPercent}% deposit</div>
            <div className="tnum mt-1 font-tech text-[18px] font-bold text-ink">{formatPkr(cart.depositPaisa)}</div>
            <p className="mt-1 text-[12px] text-muted">Balance due before dispatch.</p>
          </div>

          <Link
            href="/checkout"
            className="cut label mt-2 block bg-ink py-3.5 text-center text-[14px] font-bold text-white hover:opacity-90"
          >
            Checkout
          </Link>

          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Imported to order — {settings.leadTimeMinDays} to {settings.leadTimeMaxDays} days to your door.
          </p>
        </aside>
      </div>
    </div>
  );
}
