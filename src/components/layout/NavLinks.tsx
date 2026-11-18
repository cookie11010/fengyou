"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavLink } from "@/lib/navigation";

type NavLinksProps = {
  links: NavLink[];
  orientation: "horizontal" | "vertical";
  onNavigate?: () => void;
};

/** Menu links that mark the current page with aria-current for screen readers. */
export function NavLinks({ links, orientation, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const homeHref = links[0]?.href;

  return (
    <ul className={cn("flex", orientation === "horizontal" ? "items-center gap-1" : "flex-col gap-1")}>
      {links.map(({ href, label }) => {
        const isActive = href === homeHref ? pathname === href : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 font-medium transition-colors",
                orientation === "vertical" && "py-3 text-lg",
                isActive ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
