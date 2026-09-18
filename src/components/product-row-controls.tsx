"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setStatus, toggleFeatured, updateVariantPrice, deleteProduct } from "@/app/admin/(dashboard)/products/actions";
import { formatCny } from "@/lib/money";

interface V { id: string; name: string; pricePaisa: number; costFen: number }

export function ProductRowControls({
  id, slug, status, featured, variants,
}: { id: string; slug: string; status: string; featured: boolean; variants: V[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(variants.map((v) => [v.id, v.pricePaisa]))
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-1.5 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "PUBLISHED" ? (
          <Btn onClick={() => start(() => setStatus(id, "PUBLISHED").then(() => {}))} disabled={pending}>
            Publish
          </Btn>
        ) : (
          <Btn onClick={() => start(() => setStatus(id, "DRAFT").then(() => {}))} disabled={pending}>
            Unpublish
          </Btn>
        )}
        <Btn onClick={() => start(() => toggleFeatured(id, !featured).then(() => {}))} disabled={pending}>
          {featured ? "Remove from bestsellers" : "Add to bestsellers"}
        </Btn>
        <Btn onClick={() => setOpen((o) => !o)}>{open ? "Hide prices" : "Edit prices"}</Btn>
        <Link href={`/product/${slug}`} className="label px-3 py-1.5 text-[11.5px] text-muted underline">
          View
        </Link>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-[12.5px] text-danger">Delete permanently?</span>
            <Btn danger onClick={() => start(() => deleteProduct(id).then(() => {}))} disabled={pending}>
              Yes, delete
            </Btn>
            <Btn onClick={() => setConfirming(false)}>Cancel</Btn>
          </span>
        ) : (
          <Btn danger onClick={() => setConfirming(true)}>Delete</Btn>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-1.5 border border-line bg-sunk p-3">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{v.name}</span>
              <span className="tnum font-tech text-[12px] text-muted">{formatCny(v.costFen)}</span>
              <input
                id={`price-${v.id}`}
                type="number"
                min={0}
                value={Math.round((prices[v.id] ?? 0) / 100)}
                onChange={(e) => setPrices({ ...prices, [v.id]: Number(e.target.value) * 100 })}
                className="tnum w-28 border border-line bg-surface px-2 py-1.5 font-tech text-[13px] font-bold text-ink outline-none focus-visible:border-ink"
              />
              <Btn
                onClick={() => start(() => updateVariantPrice(v.id, prices[v.id]).then(() => {}))}
                disabled={pending || prices[v.id] === v.pricePaisa}
              >
                Save
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, danger }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`label border px-3 py-1.5 text-[11.5px] disabled:opacity-40 ${
        danger ? "border-danger text-danger hover:bg-[#fbeae7]" : "border-line text-body hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
