// Server-only translation loader. The locale comes from the [lang] URL segment
// via next/root-params, so callers don't need to pass it around.
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";
import type zhTW from "./dictionaries/zh-TW.json";

export type Dictionary = typeof zhTW;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  "zh-TW": () => import("./dictionaries/zh-TW.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
