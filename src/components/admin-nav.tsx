"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/products", "Products"],
  ["/admin/import", "Import from 1688"],
  ["/admin/orders", "Orders"],
  ["/admin/settings", "Settings"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex overflow-x-auto lg:flex-col lg:overflow-visible">
      {LINKS.map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap border-l-[3px] px-5 py-2.5 text-[14.5px] ${
              active
                ? "border-white bg-panel-2 text-white"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
