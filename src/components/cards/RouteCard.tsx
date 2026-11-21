import Link from "next/link";
import { AddToTripMenu } from "@/components/itinerary/AddToTripMenu";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/lib/format";
import type { Route } from "@/types/content";

type RouteCardProps = {
  route: Route;
  locale: Locale;
  labels: Dictionary["home"]["routes"];
  saveLabels: Dictionary["save"];
  /** Place slug -> database id, for the stops that are places on the map. */
  placeIds: Record<string, string>;
};

export function RouteCard({ route, locale, labels, saveLabels, placeIds }: RouteCardProps) {
  // Only stops that are real places on the map can go in a trip.
  const ids = route.stops.flatMap((s) => (s.spot && placeIds[s.spot] ? [placeIds[s.spot]] : []));

  return (
    <article className="fy-lift flex h-full flex-col rounded-2xl bg-surface p-6 ring-1 ring-line">
      <p className="text-sm font-medium text-brand-600">{route.theme[locale]}</p>
      <h3 className="mt-1 font-display text-2xl font-semibold text-ink">{route.title[locale]}</h3>
      <p className="mt-2 flex gap-3 text-sm text-muted">
        <span>{fill(labels.duration, { hours: route.durationHours })}</span>
        <span aria-hidden="true">·</span>
        <span>{fill(labels.stops, { count: route.stops.length })}</span>
      </p>

      {/* The stops drawn as a vertical line of numbered dots. */}
      <h4 className="sr-only">{labels.stopsHeading}</h4>
      <ol className="mb-6 mt-6 space-y-4">
        {route.stops.map((stop, i) => (
          <li key={stop.name.en} className="relative flex items-center gap-4">
            {i < route.stops.length - 1 && (
              <span aria-hidden="true" className="absolute left-4 top-8 h-4 w-px bg-brand-100" />
            )}
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
            >
              {i + 1}
            </span>
            {stop.spot && placeIds[stop.spot] ? (
              <Link href={`/${locale}/spots/${stop.spot}`} className="text-ink underline-offset-4 hover:text-brand-700 hover:underline">
                {stop.name[locale]}
              </Link>
            ) : (
              <span className="text-ink">{stop.name[locale]}</span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-auto">
        <AddToTripMenu
          destinationIds={ids}
          label={route.title[locale]}
          newTripTitle={route.title[locale]}
          buttonText={labels.addRoute}
          locale={locale}
          t={saveLabels}
        />
      </div>
    </article>
  );
}

/** The last card in the routes row: start an empty trip and pick the stops yourself. */
export function MakeYourOwnCard({ locale, labels }: { locale: Locale; labels: Dictionary["home"]["routes"] }) {
  return (
    <Link
      href={`/${locale}/itinerary?new=1`}
      className="fy-lift flex h-full flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-500/50 bg-canvas p-6 text-left hover:border-brand-500"
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">＋</span>
      <span className="font-display text-2xl font-semibold text-ink">{labels.ownTitle}</span>
      <span className="text-sm text-muted">{labels.ownText}</span>
      <span className="font-medium text-brand-700">{labels.ownCta} <span aria-hidden="true">→</span></span>
    </Link>
  );
}
