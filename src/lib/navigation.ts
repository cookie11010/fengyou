import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** One source of truth for the main menu, used by desktop and mobile nav. */
export const navItems = [
  { key: "home", path: "" },
  { key: "spots", path: "/spots" },
  { key: "stories", path: "/stories" },
  { key: "itinerary", path: "/itinerary" },
  // Routes and About come back once those pages exist.
] as const satisfies ReadonlyArray<{ key: keyof Dictionary["nav"]; path: string }>;

export type NavLink = { href: string; label: string };

export function buildNavLinks(locale: Locale, labels: Dictionary["nav"]): NavLink[] {
  return navItems.map((item) => ({
    href: `/${locale}${item.path}`,
    label: labels[item.key],
  }));
}

/** Swap the locale prefix of a path: ("/en/spots", "zh-TW") -> "/zh-TW/spots" */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  segments[1] = target;
  return segments.join("/") || `/${target}`;
}
