// Turns a destination row from Supabase into the shape the UI uses, in one
// language. Shared by the server (map, stories) and the browser (itinerary).
import { defaultLocale, type Locale } from "@/i18n/config";
import { mediaUrl } from "@/lib/supabase/public-client";
import type { MapDestination, SpotCategory, SpotOrigin } from "@/types/content";

/** The columns to select so a row can be turned into a MapDestination. */
export const DESTINATION_COLUMNS = `id, slug, category, origin, latitude, longitude,
  translations:destination_translations (locale, name, summary, address),
  cover:media!destinations_cover_media_fk (storage_path, alt_text, credit_author, license, source_url)`;

export type DestinationRow = {
  id: string;
  slug: string;
  category: SpotCategory;
  origin?: SpotOrigin; // missing only before the 20261118130000 migration
  latitude: number | null;
  longitude: number | null;
  translations: { locale: string; name: string; summary: string; address: string | null }[];
  cover: {
    storage_path: string;
    alt_text: Record<string, string>;
    credit_author: string | null;
    license: string | null;
    source_url: string | null;
  } | null;
};

/** Pick the visitor's language, falling back to zh-TW, then whatever exists. */
export function pickLocale<T extends { locale: string }>(rows: T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === defaultLocale) ?? rows[0];
}

/** Returns null when the place has no reviewed translation to show yet. */
export function toMapDestination(row: DestinationRow, locale: Locale): MapDestination | null {
  const t = pickLocale(row.translations, locale);
  if (!t) return null;
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    origin: row.origin ?? "official",
    lat: row.latitude ?? 0,
    lng: row.longitude ?? 0,
    name: t.name,
    summary: t.summary,
    address: t.address ?? undefined,
    image: row.cover
      ? {
          src: mediaUrl(row.cover.storage_path),
          alt: row.cover.alt_text[locale] ?? row.cover.alt_text[defaultLocale] ?? "",
          credit:
            row.cover.credit_author && row.cover.license
              ? { author: row.cover.credit_author, license: row.cover.license, sourceUrl: row.cover.source_url ?? undefined }
              : undefined,
        }
      : undefined,
  };
}
