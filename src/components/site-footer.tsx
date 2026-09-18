import Link from "next/link";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  { title: "Shop", links: [["All accessories", "/shop"], ["Interior", "/shop?category=interior"], ["Exterior", "/shop?category=exterior"], ["Protection", "/shop?category=protection"]] },
  { title: "Help", links: [["Fitment guide", "/fitment"], ["Delivery times", "/delivery"], ["Returns", "/returns"], ["Contact", "/contact"]] },
  { title: "Company", links: [["About us", "/about"], ["Payment options", "/payment"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-14 bg-ink px-5 pb-8 pt-10 lg:px-12">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <Wordmark tone="light" />
        <div className="flex flex-wrap gap-10 sm:gap-16">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5">
              <span className="label text-[10.5px] text-white">{col.title}</span>
              {col.links.map(([label, href]) => (
                <Link key={label} href={href} className="text-[13.5px] text-muted hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-8 max-w-[88ch] border-t border-panel-2 pt-4 text-[12px] leading-relaxed text-[#6b6f71]">
        Independent retailer of aftermarket accessories. Not affiliated with, endorsed by, or an
        official dealer of JAECOO, OMODA or Chery Automobile. Model names are used only to indicate
        vehicle fitment.
      </p>
    </footer>
  );
}
