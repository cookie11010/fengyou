"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/lib/navigation";

/** Switches language while staying on the same page. */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex items-center rounded-full border border-line bg-surface p-0.5 text-sm">
        {locales.map((locale) => {
          const isCurrent = locale === current;
          return (
            <li key={locale}>
              <Link
                href={switchLocalePath(pathname, locale)}
                hrefLang={locale}
                lang={locale}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "block rounded-full px-3 py-1.5 transition-colors",
                  isCurrent ? "bg-brand-600 text-white" : "text-muted hover:text-brand-700",
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
