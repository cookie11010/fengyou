"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NavLinks } from "./NavLinks";
import type { NavLink } from "@/lib/navigation";

type MobileMenuProps = {
  links: NavLink[];
  labels: { open: string; close: string; nav: string };
  children?: ReactNode; // extra content, e.g. the language switcher
};

/**
 * Disclosure-pattern menu for small screens: a button with aria-expanded
 * controls the panel; Escape closes it and returns focus to the button.
 */
export function MobileMenu({ links, labels, children }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-brand-50"
      >
        <span className="sr-only">{open ? labels.close : labels.open}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2}>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-surface px-4 pb-6 pt-2 shadow-lg"
      >
        <nav aria-label={labels.nav}>
          <NavLinks links={links} orientation="vertical" onNavigate={() => setOpen(false)} />
        </nav>
        {children && <div className="mt-4 border-t border-line pt-4">{children}</div>}
      </div>
    </div>
  );
}
