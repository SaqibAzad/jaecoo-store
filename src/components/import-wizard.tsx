"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { runImport, publishImport } from "@/app/admin/(dashboard)/import/actions";
import type { ImportPreview } from "@/lib/import-1688";
import { formatPkr, formatCny } from "@/lib/money";

type Option = { slug: string; name: string };

export function ImportWizard({ models, categories }: { models: Option[]; categories: Option[] }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // editable fields, seeded once a preview arrives
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [fitment, setFitment] = useState("");
  const [modelSlug, setModelSlug] = useState(models[0]?.slug ?? "");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [featured, setFeatured] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});

  function fetchIt() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await runImport(url.trim());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const p = res.preview;
      setPreview(p);
      setTitle(p.suggestedTitle);
      setSubtitle("");
      setDescription("");
      setFitment("");
      setNames(Object.fromEntries(p.variants.map((v) => [v.nameZh, v.name])));
      setPrices(Object.fromEntries(p.variants.map((v) => [v.nameZh, v.pricePaisa])));
    });
  }

  function save(publish: boolean) {
    if (!preview) return;
    setError(null);
    start(async () => {
      const res = await publishImport({
        offerId: preview.offerId,
        title,
        subtitle,
        descriptionMd: description,
        fitmentNote: fitment,
        modelSlug,
        categorySlug: categorySlug || null,
        publish,
        featured,
        variantNames: names,
        variantPrices: prices,
      });
      if (!res.ok) setError(res.error);
      else setDone(res.slug);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* url bar */}
      <div className="flex flex-col gap-2 border border-line bg-surface p-4 sm:flex-row sm:items-center">
        <input
          id="import-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://qr.1688.com/s/… or a detail.1688.com link"
          className="tnum min-w-0 flex-1 border border-line bg-sunk px-3 py-2.5 font-tech text-[13.5px] text-ink outline-none focus-visible:border-ink"
        />
        <button
          type="button"
          onClick={fetchIt}
          disabled={pending || url.trim().length === 0}
          className="cut-sm label shrink-0 bg-ink px-6 py-3 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {pending && !preview ? "Fetching…" : "Fetch"}
        </button>
      </div>

      {pending && !preview && (
        <p className="text-[13.5px] text-muted">
          Downloading images, variants and prices. A listing with a video can take a minute.
        </p>
      )}

      {error && (
        <pre role="alert" className="overflow-x-auto whitespace-pre-wrap border border-danger bg-[#fbeae7] p-4 text-[12.5px] text-danger">
          {error}
        </pre>
      )}

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-good bg-[#e6f2ec] p-4">
          <span className="text-[14px] text-good">Saved.</span>
          <div className="flex gap-4">
            <Link href={`/product/${done}`} className="label text-[12px] text-good underline">
              View on the store
            </Link>
            <Link href="/admin/products" className="label text-[12px] text-good underline">
              All products
            </Link>
          </div>
        </div>
      )}

      {preview && !done && (
        <>
          {preview.alreadyImported && (
            <p className="border border-warn bg-warn-soft px-4 py-2.5 text-[13.5px] text-warn-deep">
              This offer has been imported before. Saving replaces the existing product.
            </p>
          )}
          {preview.warnings.map((w) => (
            <p key={w} className="border border-warn bg-warn-soft px-4 py-2.5 text-[13.5px] text-warn-deep">
              {w}
            </p>
          ))}

          <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
            {/* media */}
            <div className="flex flex-col gap-4">
              <Panel title="Gallery" note={`${preview.gallery.length} images`}>
                <div className="grid grid-cols-4 gap-1.5">
                  {preview.gallery.map((src, i) => (
                    <div key={src} className={`relative aspect-square bg-sunk ${i === 0 ? "border-2 border-ink" : "border border-line"}`}>
                      <Image src={src} alt="" fill sizes="90px" className="object-cover" />
                      {i === 0 && (
                        <span className="absolute left-0 top-0 bg-ink px-1.5 py-0.5 font-tech text-[9px] text-white">
                          COVER
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>

              {preview.description.length > 0 && (
                <Panel title="Description images" note={`${preview.description.length} images`}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative aspect-square w-16 shrink-0 border border-line bg-sunk">
                      <Image src={preview.description[preview.description.length - 1]} alt="" fill sizes="72px" className="object-contain" />
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-muted">
                      1688 descriptions are images with no text. Write your own copy on the right;
                      the last image is usually the fitment chart.
                    </p>
                  </div>
                </Panel>
              )}
            </div>

            {/* copy + variants */}
            <div className="flex flex-col gap-4">
              <Panel title="Listing">
                <Field label="Original title (1688)">
                  <p className="text-[13px] text-muted">{preview.titleZh}</p>
                </Field>
                <Field label="Store title">
                  <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Subtitle">
                  <input id="p-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="L-type 4-button key · J7 / J5" className={inputCls} />
                </Field>
                <Field label="Description">
                  <textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
                </Field>
                <Field label="Fitment note — shown as a warning on the product page">
                  <textarea
                    id="p-fit"
                    value={fitment}
                    onChange={(e) => setFitment(e.target.value)}
                    rows={2}
                    placeholder="Fits the L-type 4-button key only. Compare with the photo before ordering."
                    className="w-full border border-warn bg-warn-soft px-3 py-2 text-[13.5px] text-warn-deep outline-none"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Model">
                    <select id="p-model" value={modelSlug} onChange={(e) => setModelSlug(e.target.value)} className={inputCls}>
                      {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Category">
                    <select id="p-cat" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
                <label className="mt-1 flex items-center gap-2.5">
                  <input id="p-featured" type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[#0b0d0e]" />
                  <span className="text-[13.5px] text-ink">Show in bestsellers on the home page</span>
                </label>
              </Panel>

              <Panel title="Variants & pricing" note={`cost × ${"markup"} applied — edit any price`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse">
                    <thead>
                      <tr className="bg-sunk">
                        {["Photo", "Variant", "Cost", "Sell (Rs)", "Stock"].map((h) => (
                          <th key={h} className="label border-b border-line px-2.5 py-2 text-left text-[10px] text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.variants.map((v) => (
                        <tr key={v.nameZh} className="border-b border-line-soft last:border-0">
                          <td className="px-2.5 py-2">
                            {v.photo ? (
                              <div className="relative h-11 w-11 border border-line bg-sunk">
                                <Image src={`/products/${preview.offerId}/sku/${v.photo}`} alt="" fill sizes="44px" className="object-cover" />
                              </div>
                            ) : (
                              <span className="text-[11px] text-warn-deep">none</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              id={`v-${v.nameZh}`}
                              value={names[v.nameZh] ?? ""}
                              onChange={(e) => setNames({ ...names, [v.nameZh]: e.target.value })}
                              className="w-full border border-line bg-sunk px-2 py-1.5 text-[13px] text-ink outline-none focus-visible:border-ink"
                            />
                            <span className="mt-0.5 block text-[10.5px] text-faint">{v.nameZh}</span>
                          </td>
                          <td className="tnum px-2.5 py-2 font-tech text-[13px] text-muted">{formatCny(v.costFen)}</td>
                          <td className="px-2.5 py-2">
                            <input
                              id={`p-${v.nameZh}`}
                              type="number"
                              min={0}
                              value={Math.round((prices[v.nameZh] ?? 0) / 100)}
                              onChange={(e) => setPrices({ ...prices, [v.nameZh]: Number(e.target.value) * 100 })}
                              className="tnum w-24 border border-line bg-sunk px-2 py-1.5 font-tech text-[13px] font-bold text-ink outline-none focus-visible:border-ink"
                            />
                          </td>
                          <td className="tnum px-2.5 py-2 text-[12.5px] text-faint">{v.stock.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  Supplier stock is shown for your reference only — it is never displayed on the store.
                </p>
              </Panel>

              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => save(true)} disabled={pending} className="cut-sm label bg-ink px-6 py-3 text-[13px] font-bold text-white disabled:opacity-40">
                  {pending ? "Saving…" : "Publish to store"}
                </button>
                <button type="button" onClick={() => save(false)} disabled={pending} className="cut-sm label border border-line bg-surface px-6 py-3 text-[13px] font-bold text-body disabled:opacity-40">
                  Save as draft
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const inputCls =
  "w-full border border-line bg-sunk px-3 py-2 text-[13.5px] text-ink outline-none focus-visible:border-ink";

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="label text-[12.5px] text-ink">{title}</h2>
        {note && <span className="text-[11.5px] text-muted">{note}</span>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label text-[10.5px] text-muted">{label}</span>
      {children}
    </div>
  );
}
