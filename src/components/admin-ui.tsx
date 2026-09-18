import Link from "next/link";
import type { ReactNode } from "react";

export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4 lg:px-7">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-tech text-[22px] font-bold text-ink">{title}</h1>
        {subtitle && <span className="text-[13px] text-muted">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "danger" | "warn" | "good";
}) {
  const colour = {
    ink: "text-ink",
    danger: "text-danger",
    warn: "text-warn-deep",
    good: "text-good",
  }[tone];
  return (
    <div className="flex flex-col gap-1 border border-line bg-surface p-4">
      <span className="label text-[10.5px] text-muted">{label}</span>
      <span className={`tnum font-tech text-[22px] font-bold ${colour}`}>{value}</span>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  );
}

export function Empty({ title, hint, href, cta }: { title: string; hint?: string; href?: string; cta?: string }) {
  return (
    <div className="border border-line bg-surface p-10 text-center">
      <p className="text-[15px] text-body">{title}</p>
      {hint && <p className="mt-1 text-[13.5px] text-muted">{hint}</p>}
      {href && cta && (
        <Link href={href} className="cut-sm label mt-4 inline-block bg-ink px-5 py-2.5 text-[12.5px] font-bold text-white">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  const map: Record<string, string> = {
    danger: "bg-[#fbeae7] text-danger",
    warn: "bg-warn-soft text-warn-deep",
    info: "bg-[#e6f0f4] text-[#16576b]",
    neutral: "bg-[#eeece8] text-[#5a6169]",
    good: "bg-[#e6f2ec] text-good",
  };
  return (
    <span className={`inline-flex w-fit items-center px-2.5 py-1 text-[12px] font-semibold ${map[tone] ?? map.neutral}`}>
      {children}
    </span>
  );
}
