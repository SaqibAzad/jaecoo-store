import Link from "next/link";
import { db, getSettings } from "@/lib/db";
import { formatPkr } from "@/lib/money";
import { STATE_META, AWAITING_MONEY, WITH_SUPPLIER, type OrderState } from "@/lib/order-state";
import { PageHead, Stat, Empty, Pill } from "@/components/admin-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const [orders, products, pendingPayments, settings] = await Promise.all([
    db.order.findMany({ orderBy: { placedAt: "desc" }, take: 8 }),
    db.product.count(),
    db.payment.count({ where: { status: "PENDING_REVIEW" } }),
    getSettings(),
  ]);

  const all = await db.order.findMany({
    select: { state: true, totalPaisa: true, paidPaisa: true, depositPaisa: true },
  });

  // What is actually owed, split by which side of the transaction it sits on.
  const awaitingDeposit = all
    .filter((o) => o.state === "AWAITING_DEPOSIT")
    .reduce((s, o) => s + o.depositPaisa - o.paidPaisa, 0);
  const balancesDue = all
    .filter((o) => AWAITING_MONEY.includes(o.state) && o.state !== "AWAITING_DEPOSIT")
    .reduce((s, o) => s + o.totalPaisa - o.paidPaisa, 0);
  const withSupplier = all.filter((o) => WITH_SUPPLIER.includes(o.state)).length;
  const collected = all.reduce((s, o) => s + o.paidPaisa, 0);

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle={`¥1 = Rs ${settings.cnyToPkr} · markup ×${settings.markup} · ${settings.depositPercent}% deposit`}
      />

      <div className="p-5 lg:p-7">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Awaiting deposit" value={formatPkr(awaitingDeposit)} sub="chase these first" tone="danger" />
          <Stat label="Balances due" value={formatPkr(balancesDue)} sub="before dispatch" tone="warn" />
          <Stat label="With supplier" value={String(withSupplier)} sub="ordered or in transit" />
          <Stat label="Collected" value={formatPkr(collected)} sub="verified payments" tone="good" />
        </div>

        {pendingPayments > 0 && (
          <Link
            href="/admin/orders?filter=pending-payments"
            className="mt-4 flex items-center justify-between gap-4 border border-warn bg-warn-soft px-4 py-3"
          >
            <span className="text-[14px] text-warn-deep">
              <strong>{pendingPayments}</strong> payment{pendingPayments === 1 ? "" : "s"} waiting to be verified
            </span>
            <span className="label text-[12px] text-warn-deep">Review →</span>
          </Link>
        )}

        <div className="mt-7 flex items-center justify-between gap-4">
          <h2 className="label text-[13px] text-ink">Latest orders</h2>
          <Link href="/admin/orders" className="label text-[12px] text-muted hover:text-ink">
            All orders →
          </Link>
        </div>

        <div className="mt-3">
          {orders.length === 0 ? (
            <Empty
              title="No orders yet."
              hint={
                products === 0
                  ? "Import a product first, then publish it."
                  : "Orders will appear here as customers place them."
              }
              href={products === 0 ? "/admin/import" : undefined}
              cta={products === 0 ? "Import a product" : undefined}
            />
          ) : (
            <div className="overflow-x-auto border border-line bg-surface">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="bg-sunk">
                    {["Order", "Customer", "Total", "Balance", "State"].map((h) => (
                      <th key={h} className="label border-b border-line px-4 py-2.5 text-left text-[10px] text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const meta = STATE_META[o.state as OrderState];
                    return (
                      <tr key={o.id} className="border-b border-line-soft last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/admin/orders/${o.id}`} className="tnum font-tech text-[13px] text-[#16576b]">
                            {o.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[13.5px] text-ink">
                          {o.customerName}
                          <span className="block text-[11.5px] text-faint">{o.city}</span>
                        </td>
                        <td className="tnum px-4 py-3 text-[13px] text-ink">{formatPkr(o.totalPaisa)}</td>
                        <td className={`tnum px-4 py-3 text-[13px] ${o.totalPaisa - o.paidPaisa > 0 ? "font-semibold text-danger" : "text-faint"}`}>
                          {formatPkr(o.totalPaisa - o.paidPaisa)}
                        </td>
                        <td className="px-4 py-3">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
