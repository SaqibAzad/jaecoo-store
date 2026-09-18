import { redirect } from "next/navigation";
import { getCart } from "@/lib/cart";
import { getSettings } from "@/lib/db";
import { formatPkr } from "@/lib/money";
import { placeOrder } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const sp = await searchParams;
  const [cart, settings] = await Promise.all([getCart(), getSettings()]);
  if (cart.items.length === 0) redirect("/cart");

  const problem =
    sp.error === "missing" ? "Please fill in your name, phone, address and city."
    : sp.error === "failed" ? "Something went wrong placing that order. Please try again."
    : null;

  return (
    <div className="px-5 pt-8 lg:px-12 lg:pt-10">
      <h1 className="font-mark text-[20px] text-ink lg:text-[26px]">CHECKOUT</h1>

      <form action={placeOrder} className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <div className="flex flex-col gap-4">
          {problem && (
            <p role="alert" className="border border-danger bg-[#fbeae7] px-3 py-2 text-[13.5px] text-danger">
              {problem}
            </p>
          )}

          <section className="border border-line bg-surface p-5">
            <h2 className="label mb-4 text-[12.5px] text-ink">Where it goes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <F id="customerName" label="Full name" required />
              <F id="phone" label="Phone" required type="tel" hint="We call to confirm before ordering." />
              <F id="email" label="Email (optional)" type="email" />
              <F id="city" label="City" required />
            </div>
            <div className="mt-3"><F id="addressLine" label="Address" required /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <F id="postcode" label="Postcode (optional)" />
            </div>
            <div className="mt-3"><F id="notes" label="Anything we should know? (optional)" /></div>
          </section>

          <section className="border border-line bg-surface p-5">
            <h2 className="label mb-3 text-[12.5px] text-ink">How you would like to pay</h2>
            <label className="flex cursor-pointer items-start gap-3 border border-line p-3.5 has-[:checked]:border-ink has-[:checked]:border-2">
              <input type="radio" name="plan" value="FULL" defaultChecked className="mt-1 accent-[#0b0d0e]" />
              <span>
                <span className="block text-[14px] font-medium text-ink">Pay in full — {formatPkr(cart.totalPaisa)}</span>
                <span className="block text-[12.5px] text-muted">We order from the supplier as soon as it clears.</span>
              </span>
            </label>
            <label className="mt-2.5 flex cursor-pointer items-start gap-3 border border-line p-3.5 has-[:checked]:border-ink has-[:checked]:border-2">
              <input type="radio" name="plan" value="PARTIAL" className="mt-1 accent-[#0b0d0e]" />
              <span>
                <span className="block text-[14px] font-medium text-ink">
                  Reserve with {cart.depositPercent}% — {formatPkr(cart.depositPaisa)} now
                </span>
                <span className="block text-[12.5px] text-muted">
                  Balance of {formatPkr(cart.totalPaisa - cart.depositPaisa)} before dispatch.
                </span>
              </span>
            </label>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Payment is by bank transfer or mobile wallet. We send the details as soon as you place
              the order, and nothing is ordered from the supplier until your payment clears.
            </p>
          </section>
        </div>

        <aside className="flex h-fit flex-col gap-3 border border-line bg-surface p-5">
          <h2 className="label text-[12.5px] text-ink">Your order</h2>
          {cart.items.map((i) => (
            <div key={i.variantId} className="flex justify-between gap-3 border-b border-line-soft pb-2 text-[13.5px]">
              <span className="min-w-0">
                <span className="block text-ink">{i.title}</span>
                <span className="block text-[12px] text-muted">{i.variantName} · ×{i.quantity}</span>
              </span>
              <span className="tnum shrink-0 font-tech text-ink">{formatPkr(i.linePaisa)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-4 pt-1 text-[15px]">
            <span className="font-medium text-ink">Total</span>
            <span className="tnum font-tech font-bold text-ink">{formatPkr(cart.totalPaisa)}</span>
          </div>
          <button type="submit" className="cut label mt-2 bg-ink py-3.5 text-[14px] font-bold text-white hover:opacity-90">
            Place order
          </button>
          <p className="text-[12px] leading-relaxed text-muted">
            Imported to order — {settings.leadTimeMinDays} to {settings.leadTimeMaxDays} days to your door.
          </p>
        </aside>
      </form>
    </div>
  );
}

function F({ id, label, required, type = "text", hint }: {
  id: string; label: string; required?: boolean; type?: string; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-[10.5px] text-muted">{label}</span>
      <input id={id} name={id} type={type} required={required}
        className="w-full border border-line bg-sunk px-3 py-2.5 text-[14px] text-ink outline-none focus-visible:border-ink" />
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}
