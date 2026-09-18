import { notFound } from "next/navigation";
import Link from "next/link";
import { db, getSettings } from "@/lib/db";
import { formatPkr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OrderConfirmation({ params }: PageProps<"/order/[number]">) {
  const { number } = await params;
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { number }, include: { items: true } }),
    getSettings(),
  ]);
  if (!order) notFound();

  const dueNow = order.plan === "PARTIAL" ? order.depositPaisa : order.totalPaisa;

  return (
    <div className="mx-auto max-w-[680px] px-5 pt-10 lg:pt-14">
      <div className="border border-good bg-[#e6f2ec] p-5">
        <h1 className="font-mark text-[18px] text-good">ORDER PLACED</h1>
        <p className="mt-1.5 text-[14px] text-body">
          Your order number is <strong className="tnum font-tech">{order.number}</strong>. Keep it for reference.
        </p>
      </div>

      <section className="mt-5 border border-line bg-surface p-5">
        <h2 className="label mb-3 text-[12.5px] text-ink">What to pay now</h2>
        <div className="tnum font-tech text-[26px] font-bold text-ink">{formatPkr(dueNow)}</div>
        {order.plan === "PARTIAL" && (
          <p className="mt-1 text-[13px] text-muted">
            Deposit. Balance of {formatPkr(order.totalPaisa - order.depositPaisa)} is due before dispatch.
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[13.5px] leading-relaxed text-body">
            We will message you on <strong>{order.phone}</strong> with bank transfer and mobile wallet
            details. Send your payment, then reply with a screenshot — we confirm it by hand and order
            from the supplier the same day.
          </p>
          <p className="mt-2.5 text-[13px] text-muted">
            Delivery takes {settings.leadTimeMinDays}–{settings.leadTimeMaxDays} days from the day
            your payment clears.
          </p>
        </div>
      </section>

      <section className="mt-4 border border-line bg-surface p-5">
        <h2 className="label mb-3 text-[12.5px] text-ink">Your order</h2>
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 border-b border-line-soft py-2 text-[13.5px] last:border-0">
            <span><span className="block text-ink">{i.titleSnapshot}</span>
              <span className="block text-[12px] text-muted">{i.variantSnapshot} · ×{i.quantity}</span></span>
            <span className="tnum font-tech text-ink">{formatPkr(i.unitPricePaisa * i.quantity)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between gap-4 border-t-2 border-ink pt-3 text-[15px]">
          <span className="font-medium text-ink">Total</span>
          <span className="tnum font-tech font-bold text-ink">{formatPkr(order.totalPaisa)}</span>
        </div>
      </section>

      <Link href="/shop" className="label mt-6 inline-block text-[12.5px] text-muted underline hover:text-ink">
        Continue shopping
      </Link>
    </div>
  );
}
