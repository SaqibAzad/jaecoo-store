"use client";

import { useState, useTransition } from "react";
import { moveOrder, addPayment, approvePayment, rejectPayment } from "@/app/admin/(dashboard)/orders/actions";
import { STATE_META, type OrderState } from "@/lib/order-state";
import { formatPkr } from "@/lib/money";

interface P {
  id: string; kind: string; method: string; status: string;
  amountPaisa: number; reference: string | null; submittedAt: string;
}

export function OrderControls({
  orderId, state, allowed, balanceRupees, payments,
}: {
  orderId: string; state: OrderState; allowed: OrderState[];
  balanceRupees: number; payments: P[]; supplierRef: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(balanceRupees);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");

  const meta = STATE_META[state];
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok && r.error) setError(r.error);
    });

  return (
    <>
      <section className="border border-line bg-surface p-4">
        <h2 className="label mb-1 text-[12.5px] text-ink">Move this order</h2>
        {meta.action && <p className="mb-3 text-[13px] text-muted">Next: {meta.action.toLowerCase()}.</p>}

        {error && <p role="alert" className="mb-3 border border-danger bg-[#fbeae7] px-3 py-2 text-[12.5px] text-danger">{error}</p>}

        {allowed.length === 0 ? (
          <p className="text-[13px] text-muted">This order is finished — no further moves.</p>
        ) : (
          <>
            <input
              id="move-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (e.g. 1688 order 8841)"
              className="mb-2.5 w-full border border-line bg-sunk px-3 py-2 text-[13px] text-ink outline-none focus-visible:border-ink"
            />
            <div className="flex flex-wrap gap-2">
              {allowed.map((to) => (
                <button
                  key={to}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => moveOrder(orderId, to, note || undefined))}
                  className={`label px-3.5 py-2 text-[11.5px] disabled:opacity-40 ${
                    to === "CANCELLED" || to === "REFUNDED"
                      ? "border border-danger text-danger hover:bg-[#fbeae7]"
                      : "bg-ink text-white hover:opacity-90"
                  }`}
                >
                  {STATE_META[to].label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="border border-line bg-surface p-4">
        <h2 className="label mb-3 text-[12.5px] text-ink">Payments</h2>

        {payments.length === 0 && <p className="mb-3 text-[13px] text-muted">Nothing recorded yet.</p>}

        <div className="mb-4 flex flex-col gap-2">
          {payments.map((p) => (
            <div key={p.id} className="border border-line-soft bg-sunk p-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="tnum font-tech text-[14px] font-bold text-ink">{formatPkr(p.amountPaisa)}</span>
                <span className={`px-2 py-0.5 text-[11px] font-semibold ${
                  p.status === "VERIFIED" ? "bg-[#e6f2ec] text-good"
                  : p.status === "REJECTED" ? "bg-[#fbeae7] text-danger"
                  : "bg-warn-soft text-warn-deep"
                }`}>
                  {p.status.replace("_", " ").toLowerCase()}
                </span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                {p.kind.toLowerCase()} · {p.method.replace("_", " ").toLowerCase()}
                {p.reference ? ` · ${p.reference}` : ""}
              </div>
              {p.status === "PENDING_REVIEW" && (
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={pending}
                    onClick={() => run(() => approvePayment(p.id, orderId))}
                    className="label bg-good px-3 py-1.5 text-[11px] text-white disabled:opacity-40">
                    Verify
                  </button>
                  <button type="button" disabled={pending}
                    onClick={() => run(async () => rejectPayment(p.id, orderId, "Could not match the transfer"))}
                    className="label border border-danger px-3 py-1.5 text-[11px] text-danger disabled:opacity-40">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="label text-[10.5px] text-muted">Record a payment</span>
          <div className="flex gap-2">
            <input
              id="pay-amount" type="number" min={0} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="tnum w-28 border border-line bg-sunk px-2.5 py-2 font-tech text-[13px] text-ink outline-none focus-visible:border-ink"
            />
            <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}
              className="min-w-0 flex-1 border border-line bg-sunk px-2.5 py-2 text-[13px] text-ink outline-none">
              {["BANK_TRANSFER", "JAZZCASH", "EASYPAISA", "CARD", "OTHER"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </div>
          <input
            id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction reference"
            className="w-full border border-line bg-sunk px-3 py-2 text-[13px] text-ink outline-none focus-visible:border-ink"
          />
          <button
            type="button" disabled={pending || amount <= 0}
            onClick={() =>
              run(() =>
                addPayment({
                  orderId,
                  kind: state === "AWAITING_DEPOSIT" ? "DEPOSIT" : "BALANCE",
                  method: method as "BANK_TRANSFER",
                  amountRupees: amount,
                  reference,
                })
              )
            }
            className="cut-sm label bg-ink px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-40"
          >
            Record payment
          </button>
          <p className="text-[11.5px] text-muted">
            Recording does not move the order — verify it first, which is what counts the money.
          </p>
        </div>
      </section>
    </>
  );
}
