// Runs before every page request. If the URL has no locale prefix
// (e.g. "/spots"), redirect to the visitor's preferred language ("/en/spots").
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, locales, type Locale } from "@/i18n/config";

function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language") ?? "";
  // "zh-TW,zh;q=0.9,en;q=0.8" -> ["zh-tw", "zh", "en"] in priority order
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag);

  for (const tag of wanted) {
    const exact = locales.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    if (tag.startsWith("zh")) return "zh-TW";
    if (tag.startsWith("en")) return "en";
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";
  if (hasLocale(firstSegment)) return;

  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next.js internals, API routes and any file with an extension (images, icons…)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
