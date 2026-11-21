"use client";

// "Add to trip" for one place or a whole route. People can keep several
// trips, so the button opens a small menu: pick a trip, or start a new one.
// With no trips yet, one tap makes the first trip straight away.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useSession, type TripSummary } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";

type Props = {
  destinationIds: string[];
  /** For the accessible name, e.g. "Add to trip: Moat Park". */
  label: string;
  /** Name for a new trip made from this button (a route's title, or "My Hsinchu trip"). */
  newTripTitle: string;
  locale: Locale;
  t: Dictionary["save"];
  /** Text on the button. Defaults to "Add to trip". */
  buttonText?: string;
  /** Open the menu above the button (e.g. at the bottom of the map). */
  openUp?: boolean;
  className?: string;
};

const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors";

export function AddToTripMenu({ destinationIds, label, newTripTitle, locale, t, buttonText, openUp, className }: Props) {
  const { status, trips, savedIds, addToTrip } = useSession();
  const pathname = usePathname();
  const menuId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; tripId: string; title: string } | { ok: false } | null>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "unavailable" || destinationIds.length === 0) return null;
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

  const inEveryPlace = (trip: TripSummary) => destinationIds.every((id) => trip.placeIds.includes(id));
  const alreadySaved = destinationIds.every((id) => savedIds.has(id));

  async function add(target: { tripId: string; title: string } | null) {
    setOpen(false);
    setBusy(true);
    setResult(null);
    try {
      const tripId = await addToTrip(target ? { tripId: target.tripId } : { newTitle: newTripTitle }, destinationIds);
      setResult({ ok: true, tripId, title: target?.title ?? newTripTitle });
    } catch {
      setResult({ ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span ref={wrapRef} className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        aria-label={`${buttonText ?? t.save}: ${label}`}
        aria-expanded={trips.length > 0 ? open : undefined}
        aria-controls={trips.length > 0 ? menuId : undefined}
        onClick={() => (trips.length === 0 ? void add(null) : setOpen((o) => !o))}
        className={cn(
          base,
          alreadySaved ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:opacity-60",
          className,
        )}
      >
        {alreadySaved ? <span aria-hidden="true">✓</span> : <PlusIcon />}
        {busy ? t.saving : alreadySaved ? t.saved : (buttonText ?? t.save)}
        {trips.length > 0 && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("size-4 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          className={cn(
            "fy-pop absolute left-0 z-40 w-64 rounded-2xl bg-surface p-2 text-sm shadow-lg ring-1 ring-line",
            openUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{t.chooseTrip}</p>
          <ul>
            {trips.map((trip) => {
              const has = inEveryPlace(trip);
              return (
                <li key={trip.id}>
                  <button
                    type="button"
                    disabled={has}
                    onClick={() => void add({ tripId: trip.id, title: trip.title })}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-ink hover:bg-sand disabled:text-muted disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 truncate">{trip.title}</span>
                    {has && <span className="shrink-0 text-xs text-brand-700">✓ {t.alreadyIn}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void add(null)}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-line px-3 py-2 text-left font-medium text-brand-700 hover:bg-brand-50"
          >
            <PlusIcon />
            <span className="min-w-0 truncate">{fill(t.newTripNamed, { name: newTripTitle })}</span>
          </button>
        </div>
      )}

      <span aria-live="polite" className="text-xs">
        {result?.ok === true && (
          <span className="text-muted">
            {fill(t.addedTo, { name: result.title })}{" "}
            <Link href={`/${locale}/itinerary?trip=${result.tripId}`} className="font-medium text-brand-700 underline underline-offset-2">
              {t.viewTrip}
            </Link>
          </span>
        )}
        {result?.ok === false && <span role="alert" className="text-brand-700">{t.failed}</span>}
      </span>
    </span>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
