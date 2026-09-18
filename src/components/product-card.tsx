import Link from "next/link";
import Image from "next/image";
import { formatPkr } from "@/lib/money";

export interface CardProduct {
  slug: string;
  title: string;
  subtitle: string | null;
  fitLabel: string;
  coverPath: string | null;
  fromPaisa: number;
  hasRange: boolean;
}

export function ProductCard({ p }: { p: CardProduct }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className="cut group flex flex-col border border-line bg-surface transition-colors hover:border-ink"
    >
      <div className="relative aspect-square border-b border-line-soft bg-sunk">
        {p.coverPath ? (
          <Image
            src={p.coverPath}
            alt={p.title}
            fill
            sizes="(min-width: 1024px) 20vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#cdcdca" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" />
              <path d="M3 15l5-4 4 3 3-2 6 4" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3.5 pb-4">
        <span className="label text-[9.5px] text-muted">{p.fitLabel}</span>
        <span className="text-[14px] font-medium leading-tight text-ink">{p.title}</span>
        <span className="tnum mt-0.5 font-tech text-[16px] font-bold text-ink">
          {p.hasRange ? "from " : ""}
          {formatPkr(p.fromPaisa)}
        </span>
      </div>
    </Link>
  );
}
