"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { MapDestination } from "@/types/content";

type Props = {
  destination: MapDestination;
  categoryLabel: string;
  labels: { close: string; directions: string };
  onClose: () => void;
  action?: ReactNode; // e.g. the "Add to trip" button
};

/** Details of the selected place, laid over the bottom of the map. */
export function DestinationPanel({ destination: d, categoryLabel, labels, onClose, action }: Props) {
  // Opens Google Maps (app on phones) with walking/transit directions. No API key needed.
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`;

  return (
    <article className="flex gap-3 rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-line sm:gap-4 sm:p-4">
      {d.image && (
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl sm:size-28">
          <Image src={d.image.src} alt={d.image.alt} fill sizes="112px" className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-600">{categoryLabel}</p>
            <h2 className="font-display text-lg font-semibold leading-snug text-ink">{d.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sand"
          >
            <span className="sr-only">{labels.close}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{d.summary}</p>
        {d.address && <p className="mt-1 text-xs text-muted">{d.address}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {action}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          {labels.directions}
          <span aria-hidden="true">↗</span>
        </a>
        </div>
      </div>
    </article>
  );
}
