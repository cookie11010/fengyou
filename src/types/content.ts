// Shapes of FengYou's tourism content, based on the proposal:
// student-written "spots" (據點) grouped into half-day "routes" (路線).
import type { Locale } from "@/i18n/config";

/** A value translated into every supported locale. */
export type Localized<T = string> = Record<Locale, T>;

export type SpotCategory = "food" | "temple" | "history" | "market" | "nature" | "family";

/** official = picked by the FengYou team; community = added by a user with "Add a spot". */
export type SpotOrigin = "official" | "community";

/** Openly licensed photos must credit their author and license. */
export interface Photo {
  src: string;
  alt: Localized;
  credit: { author: string; license: string; sourceUrl: string };
}

export interface Spot {
  slug: string;
  name: Localized;
  category: SpotCategory;
  summary: Localized;
  image: Photo;
  // The fields below come from student field visits. They're optional until
  // that content exists. Don't fill them with guesses.
  /** The local story written by the student contributor. */
  story?: Localized;
  /** Practical tips: menu translation, etiquette, opening hours… */
  tips?: Localized<string[]>;
  address?: Localized;
  coordinates?: { lat: number; lng: number };
  author?: string;
  /** The proposal requires every published spot to show its last verified date. */
  lastVerified?: string; // ISO date, e.g. "2026-11-01"
}

export interface RouteStop {
  name: Localized;
  /** Set when the stop has its own spot page. */
  spot?: string;
}

export interface Route {
  slug: string;
  title: Localized;
  theme: Localized;
  durationHours: number;
  stops: RouteStop[];
}

export interface CultureTopic {
  slug: string;
  title: Localized;
  body: Localized;
  image: Photo;
}

/**
 * What the map needs for one destination, already resolved to one language.
 * Built on the server (from Supabase or the sample data) and sent to the browser.
 */
export interface MapDestination {
  id: string;
  slug: string;
  category: SpotCategory;
  origin: SpotOrigin;
  lat: number;
  lng: number;
  name: string;
  summary: string;
  address?: string;
  image?: { src: string; alt: string; credit?: { author: string; license: string; sourceUrl?: string } };
}
