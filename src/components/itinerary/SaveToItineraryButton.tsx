"use client";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { AddToTripMenu } from "./AddToTripMenu";

type Props = {
  destinationId: string;
  placeName: string; // for the accessible name, e.g. "Add to trip: Moat Park"
  locale: Locale;
  t: Dictionary["save"];
  openUp?: boolean;
  className?: string;
};

/** "Add to trip" for a single place. */
export function SaveToItineraryButton({ destinationId, placeName, locale, t, openUp, className }: Props) {
  return (
    <AddToTripMenu
      destinationIds={[destinationId]}
      label={placeName}
      newTripTitle={t.defaultTripTitle}
      locale={locale}
      t={t}
      openUp={openUp}
      className={className}
    />
  );
}
