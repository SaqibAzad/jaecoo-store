import Link from "next/link";

/**
 * The store's own lockup. Deliberately not the JAECOO logo — this is an
 * independent retailer, and the footer says so.
 */
export function Wordmark({
  tone = "dark",
  size = "md",
}: {
  tone?: "dark" | "light";
  size?: "sm" | "md";
}) {
  const main = tone === "light" ? "text-white" : "text-ink";
  const sub = tone === "light" ? "text-muted" : "text-muted";
  return (
    <Link href="/" className="flex flex-col leading-none" aria-label="Jaecoo Accessories — home">
      <span
        className={`font-mark ${main} ${size === "sm" ? "text-[13px]" : "text-[16px]"}`}
        style={{ letterSpacing: "0.06em" }}
      >
        JAECOO
      </span>
      <span
        className={`label ${sub} ${size === "sm" ? "text-[8px]" : "text-[9px]"}`}
        style={{ letterSpacing: "0.32em" }}
      >
        Accessories
      </span>
    </Link>
  );
}
