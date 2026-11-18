// Shared i18n settings. Safe to import from both server and client components.
// To add a language (e.g. Bahasa Indonesia "id", Vietnamese "vi"), add it here
// and add a matching file in ./dictionaries/.

export const locales = ["zh-TW", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-TW";

export const localeLabels: Record<Locale, string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
