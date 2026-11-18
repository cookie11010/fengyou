"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";

type Props = {
  destinationId: string;
  placeName: string; // for the accessible name, e.g. "Add to trip: Moat Park"
  locale: Locale;
  t: Dictionary["save"];
  className?: string;
};

const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors";

export function SaveToItineraryButton({ destinationId, placeName, locale, t, className }: Props) {
  const { status, savedIds, saveToItinerary } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (status === "unavailable") return null;
  if (status === "loading") return <span aria-hidden="true" className={cn(base, "w-28 animate-pulse bg-sand", className)} />;

  if (status === "signed-out") {
    return (
      <Link
        href={`/${locale}/sign-in?next=${encodeURIComponent(pathname)}`}
        className={cn(base, "border border-line bg-surface text-ink hover:border-brand-500", className)}
      >
        <PlusIcon />
        {t.signIn}
      </Link>
    );
  }

  const saved = savedIds.has(destinationId);
  if (saved) {
    return (
      <Link href={`/${locale}/itinerary`} className={cn(base, "bg-brand-50 text-brand-700 hover:bg-brand-100", className)}>
        <span aria-hidden="true">✓</span>
        {t.saved}
      </Link>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        aria-label={`${t.save}: ${placeName}`}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await saveToItinerary(destinationId);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
        className={cn(base, "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60", className)}
      >
        <PlusIcon />
        {busy ? t.saving : t.save}
      </button>
      {failed && <span role="alert" className="text-xs text-brand-700">{t.failed}</span>}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
