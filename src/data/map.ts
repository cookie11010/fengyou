// Loads destinations for the map: from Supabase when it's configured,
// otherwise from the local sample data so the site still runs in development.
import "server-only";
import { cacheLife } from "next/cache";
import type { Locale } from "@/i18n/config";
import { DESTINATION_COLUMNS, toMapDestination, type DestinationRow } from "@/lib/destinations";
import { getPublicSupabase } from "@/lib/supabase/public-client";
import type { MapDestination } from "@/types/content";
import { spots } from "./index";

export type MapData = { source: "supabase" | "sample"; destinations: MapDestination[] };

export async function getMapDestinations(locale: Locale): Promise<MapData> {
  "use cache";
  cacheLife("hours"); // Published places change rarely; refetch at most every hour or so.

  const supabase = getPublicSupabase();
  if (!supabase) return { source: "sample", destinations: sampleDestinations(locale) };

  // RLS already limits this to published destinations and reviewed
  // translations; the filter below just says so explicitly.
  // "media!destinations_cover_media_fk" (inside DESTINATION_COLUMNS) names
  // which foreign key to follow, because media and destinations are linked in two ways.
  const { data, error } = await supabase
    .from("destinations")
    .select(DESTINATION_COLUMNS)
    .eq("status", "published")
    .not("latitude", "is", null)
    .overrideTypes<DestinationRow[], { merge: false }>();

  if (error) throw new Error(`Could not load destinations from Supabase: ${error.message}`);

  const destinations = (data ?? []).flatMap((row) => toMapDestination(row, locale) ?? []);
  return { source: "supabase", destinations };
}

export function sampleDestinations(locale: Locale): MapDestination[] {
  return spots.flatMap((spot) =>
    spot.coordinates
      ? [
          {
            id: spot.slug,
            slug: spot.slug,
            category: spot.category,
            lat: spot.coordinates.lat,
            lng: spot.coordinates.lng,
            name: spot.name[locale],
            summary: spot.summary[locale],
            address: spot.address?.[locale],
            image: { src: spot.image.src, alt: spot.image.alt[locale] },
          },
        ]
      : [],
  );
}
