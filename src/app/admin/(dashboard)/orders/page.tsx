import Link from "next/link";
import { db } from "@/lib/db";
import { formatPkr } from "@/lib/money";
import { STATE_META, ORDER_STATES, type OrderState } from "@/lib/order-state";
import { PageHead, Empty, Pill } from "@/components/admin-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : undefined;
  const onlyPending = sp.filter === "pending-payments";

  const orders = await db.order.findMany({
    where: {
      ...(state && ORDER_STATES.includes(state as OrderState) ? { state: state as OrderState } : {}),
      ...(onlyPending ? { payments: { some: { status: "PENDING_REVIEW" } } } : {}),
    },
    orderBy: { placedAt: "desc" },
    include: { _count: { select: { payments: true } }, payments: { where: { status: "PENDING_REVIEW" }, select: { id: true } } },
  });

  const counts = await db.order.groupBy({ by: ["state"], _count: true });
  const countFor = (s: string) => counts.find((c) => c.state === s)?._count ?? 0;

  return (
    <>
      <PageHead title="Orders" subtitle={`${orders.length} shown`} />
      <div className="p-5 lg:p-7">
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip href="/admin/orders" active={!state && !onlyPending}>All</Chip>
          {ORDER_STATES.filter((s) => countFor(s) > 0).map((s) => (
            <Chip key={s} href={`/admin/orders?state=${s}`} active={state === s}>
              {STATE_META[s].label} <span className="opacity-60">{countFor(s)}</span>
            </Chip>
          ))}
        </div>

        {orders.length === 0 ? (
          <Empty title="No orders here." hint="Orders appear as customers place them." />
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-sunk">
                  {["Order", "Customer", "Total", "Paid", "Balance", "State", ""].map((h) => (
                    <th key={h} className="label border-b border-line px-4 py-2.5 text-left text-[10px] text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = STATE_META[o.state as OrderState];
                  const balance = o.totalPaisa - o.paidPaisa;
                  return (
                    <tr key={o.id} className="border-b border-line-soft last:border-0 hover:bg-sunk">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="tnum font-tech text-[13px] text-[#16576b]">{o.number}</Link>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-ink">
                        {o.customerName}<span className="block text-[11.5px] text-faint">{o.city} · {o.phone}</span>
                      </td>
                      <td className="tnum px-4 py-3 text-[13px] text-ink">{formatPkr(o.totalPaisa)}</td>
                      <td className="tnum px-4 py-3 text-[13px] text-muted">{formatPkr(o.paidPaisa)}</td>
                      <td className={`tnum px-4 py-3 text-[13px] ${balance > 0 ? "font-semibold text-danger" : "text-faint"}`}>
                        {formatPkr(balance)}
                      </td>
                      <td className="px-4 py-3"><Pill tone={meta.tone}>{meta.label}</Pill></td>
                      <td className="px-4 py-3">
                        {o.payments.length > 0 && <Pill tone="warn">{o.payments.length} to verify</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`label px-3.5 py-2 text-[12px] ${active ? "bg-ink text-white" : "border border-line bg-surface text-body hover:border-ink"}`}>
      {children}
    </Link>
  );
}
