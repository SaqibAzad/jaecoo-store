import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPkr } from "@/lib/money";
import { STATE_META, nextStates, type OrderState } from "@/lib/order-state";
import { PageHead, Pill } from "@/components/admin-ui";
import { OrderControls } from "@/components/order-controls";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { submittedAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const meta = STATE_META[order.state as OrderState];
  const balance = order.totalPaisa - order.paidPaisa;

  return (
    <>
      <PageHead
        title={order.number}
        subtitle={`Placed ${order.placedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        action={<Link href="/admin/orders" className="label text-[12px] text-muted hover:text-ink">← All orders</Link>}
      />

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-7">
        <div className="flex flex-col gap-4">
          <section className="border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="label text-[12.5px] text-ink">Items</h2>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            {order.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="text-[14px] text-ink">{i.titleSnapshot}</div>
                  <div className="text-[12px] text-muted">{i.variantSnapshot} · ×{i.quantity}</div>
                </div>
                <div className="tnum shrink-0 font-tech text-[14px] text-ink">
                  {formatPkr(i.unitPricePaisa * i.quantity)}
                </div>
              </div>
            ))}
            <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-ink pt-3">
              <Line label="Total" value={formatPkr(order.totalPaisa)} strong />
              <Line label="Deposit asked" value={formatPkr(order.depositPaisa)} />
              <Line label="Paid" value={formatPkr(order.paidPaisa)} />
              <Line label="Balance" value={formatPkr(balance)} danger={balance > 0} strong />
            </div>
          </section>

          <section className="border border-line bg-surface p-4">
            <h2 className="label mb-3 text-[12.5px] text-ink">History</h2>
            <ol className="flex flex-col gap-2">
              {order.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                  <span className="tnum font-tech text-[11.5px] text-faint">
                    {e.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-ink">
                    {e.from ? `${STATE_META[e.from as OrderState].label} → ` : ""}
                    {STATE_META[e.to as OrderState].label}
                  </span>
                  {e.note && <span className="text-muted">— {e.note}</span>}
                  <span className="text-[11.5px] text-faint">{e.actor}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="border border-line bg-surface p-4">
            <h2 className="label mb-2.5 text-[12.5px] text-ink">Customer</h2>
            <div className="flex flex-col gap-1 text-[13.5px] text-ink">
              <span>{order.customerName}</span>
              <a href={`tel:${order.phone}`} className="text-[#16576b]">{order.phone}</a>
              {order.email && <span className="text-muted">{order.email}</span>}
              <span className="mt-1.5 text-muted">{order.addressLine}</span>
              <span className="text-muted">{order.city}{order.postcode ? ` ${order.postcode}` : ""}</span>
              {order.notes && <p className="mt-2 border-l-2 border-line pl-2.5 text-[13px] text-muted">{order.notes}</p>}
            </div>
          </section>

          <OrderControls
            orderId={order.id}
            state={order.state as OrderState}
            allowed={[...nextStates(order.state as OrderState)]}
            balanceRupees={Math.round(balance / 100)}
            payments={order.payments.map((p) => ({
              id: p.id, kind: p.kind, method: p.method, status: p.status,
              amountPaisa: p.amountPaisa, reference: p.reference,
              submittedAt: p.submittedAt.toISOString(),
            }))}
            supplierRef={order.supplierRef}
          />
        </div>
      </div>
    </>
  );
}

function Line({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[13.5px]">
      <span className="text-muted">{label}</span>
      <span className={`tnum font-tech ${strong ? "font-bold" : ""} ${danger ? "text-danger" : "text-ink"}`}>{value}</span>
    </div>
  );
}
