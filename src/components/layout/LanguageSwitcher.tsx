"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/lib/navigation";

const LEAVE_MS = 180; // matches the fade-out in globals.css

/**
 * Switches language while staying on the same page, with a small animation:
 * the highlight slides to the chosen language, the page fades out, and the
 * new language fades in (the .fy-page animation on <main>).
 * Without JavaScript, or with "reduce motion" on, it's a plain link.
 */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<Locale | null>(null);
  // The language being switched to, until it has arrived.
  const active = pending && pending !== current ? pending : current;
  const listRef = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Measure where the highlight should sit (the labels have different widths).
  // Measure again whenever the switcher changes size: in the phone menu it
  // starts hidden (0 px wide) and only gets its real size when the menu opens.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>(`[data-locale="${active}"]`);
      setPill(el && el.offsetWidth > 0 ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  // The new language has arrived: let the page show again.
  useEffect(() => {
    document.documentElement.classList.remove("fy-lang-leaving");
  }, [current]);

  // Next.js keeps pages you've left alive but hidden, so "Back" is instant.
  // When this page is hidden, forget the switch in progress, or coming back
  // would show the highlight on the wrong language.
  useEffect(() => () => setPending(null), []);

  function onClick(e: MouseEvent<HTMLAnchorElement>, locale: Locale, href: string) {
    if (locale === current || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    setPending(locale);
    document.documentElement.classList.add("fy-lang-leaving");
    setTimeout(() => router.push(href), LEAVE_MS);
  }

  return (
    <nav aria-label={label}>
      <ul ref={listRef} className="relative flex items-center rounded-full border border-line bg-surface p-0.5 text-sm">
        {/* The sliding highlight behind the active language. */}
        {pill && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 rounded-full bg-brand-600 shadow-sm transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
            style={{ left: pill.left, width: pill.width }}
          />
        )}
        {locales.map((locale) => {
          const isCurrent = locale === current;
          const href = switchLocalePath(pathname, locale);
          return (
            <li key={locale} data-locale={locale} className="relative">
              <Link
                href={href}
                hrefLang={locale}
                lang={locale}
                aria-current={isCurrent ? "true" : undefined}
                onClick={(e) => onClick(e, locale, href)}
                className={cn(
                  "block rounded-full px-3 py-1.5 transition-colors duration-300",
                  locale === active ? "text-white" : "text-muted hover:text-brand-700",
                  // Before the highlight is measured, colour the current one directly.
                  !pill && isCurrent && "bg-brand-600",
                )}
              >
                {localeLabels[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
