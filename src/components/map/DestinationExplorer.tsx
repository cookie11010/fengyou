"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SaveToItineraryButton } from "@/components/itinerary/SaveToItineraryButton";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { MapDestination, SpotCategory } from "@/types/content";
import { DestinationPanel } from "./DestinationPanel";

// Loaded only in the browser: Leaflet needs `window`.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sand" />,
});

export type ExplorerLabels = {
  mapLabel: string;
  listHeading: string;
  markerHint: string;
  close: string;
  directions: string;
  empty: string;
};

type Props = {
  locale: Locale;
  saveLabels: Dictionary["save"];
  destinations: MapDestination[];
  categories: Record<SpotCategory, string>;
  labels: ExplorerLabels;
};

/**
 * Map + list, sharing one "selected" state. The list is the accessible way
 * in: it works with a keyboard or screen reader without using the map.
 * Phones: map on top, list below. Desktop: list on the left, map on the right.
 */
export function DestinationExplorer({ locale, saveLabels, destinations, categories, labels }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const selected = destinations.find((d) => d.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function selectFromList(id: string) {
    setSelectedId(id);
    // On phones the map is above the list; bring it back into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (destinations.length === 0) {
    return <p className="rounded-2xl bg-sand p-6 text-muted">{labels.empty}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:gap-8">
      {/* Map. `isolate` keeps Leaflet's high z-indexes below the sticky header. */}
      <section
        ref={mapRef}
        aria-label={labels.mapLabel}
        className="relative isolate h-[60svh] min-h-80 scroll-mt-20 overflow-hidden rounded-2xl ring-1 ring-line lg:order-2 lg:h-[70vh]"
      >
        <LeafletMap
          destinations={destinations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          markerHint={labels.markerHint}
        />
        {/* aria-live announces the chosen place to screen readers.
            bottom-7 leaves the map attribution visible underneath. */}
        <div aria-live="polite" className="absolute inset-x-3 bottom-7 z-[1000] sm:right-auto sm:w-96">
          {selected && (
            <DestinationPanel
              destination={selected}
              categoryLabel={categories[selected.category]}
              labels={{ close: labels.close, directions: labels.directions }}
              onClose={() => setSelectedId(null)}
              action={
                <SaveToItineraryButton
                  destinationId={selected.id}
                  placeName={selected.name}
                  locale={locale}
                  t={saveLabels}
                  className="min-h-9 px-3"
                />
              }
            />
          )}
        </div>
      </section>

      <section aria-labelledby="destination-list-heading" className="lg:order-1">
        <h2 id="destination-list-heading" className="font-display text-xl font-semibold text-ink">
          {labels.listHeading}
        </h2>
        <ul className="mt-4 space-y-2">
          {destinations.map((d) => {
            const isSelected = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectFromList(d.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 transition-colors",
                    isSelected ? "bg-brand-50 ring-brand-500" : "bg-surface ring-line hover:ring-brand-500",
                  )}
                >
                  <span aria-hidden="true" className={cn("fy-pin shrink-0", isSelected && "fy-pin--selected")} style={{ width: 24, height: 24 }} />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{d.name}</span>
                    <span className="block text-xs text-muted">{categories[d.category]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
