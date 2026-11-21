"use client";

// My trip: a person can keep several trips. This shows
//   - the list of trips (name, dates, number of places), with "New trip"
//   - one opened trip: rename, set the dates, reorder, remove, add places, notes
// Which trip is open lives in the URL (?trip=<id>, or ?new=1 for the form),
// so the back button works and other pages can link straight to a trip.
// Edits stay local until "Save trip", which sends the whole trip to the
// save_trip database function in one call, so a half-saved trip is impossible.
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession, type TripSummary } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { DESTINATION_COLUMNS, toMapDestination, type DestinationRow } from "@/lib/destinations";
import { fill } from "@/lib/format";
import type { MapDestination } from "@/types/content";

type Stop = { place: MapDestination; note: string };
type Trip = { title: string; startDate: string; endDate: string; stops: Stop[] };
type ItemRow = { note: string | null; destination: DestinationRow | null };

type Props = {
  locale: Locale;
  places: MapDestination[]; // every published place, for "Add a place"
  t: Dictionary["itinerary"];
  authT: Dictionary["auth"];
};

const field = "block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-brand-500";
const iconButton =
  "inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";

/** "19 Dec – 20 Dec 2026", "19 Dec 2026", or "" when there are no dates. */
export function formatTripDates(start: string | null, end: string | null, locale: Locale): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const s = start ? new Date(`${start}T00:00:00Z`) : null;
  const e = end ? new Date(`${end}T00:00:00Z`) : null;
  if (s && e && end !== start) return fmt.formatRange(s, e);
  if (s || e) return fmt.format((s ?? e)!);
  return "";
}

export function ItineraryEditor({ locale, places, t, authT }: Props) {
  const { status, trips, tripsLoaded: loaded } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = searchParams.get("trip");
  const showNew = searchParams.get("new") === "1";

  const go = useCallback(
    (query: string) => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    [router, pathname],
  );

  if (status === "unavailable") return <p className="rounded-2xl bg-sand p-6 text-muted">{authT.unavailable}</p>;
  if (status === "loading") return <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-sand" />;
  if (status === "signed-out") {
    return (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-muted">{t.signInPrompt}</p>
        <Link
          href={`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/itinerary${showNew ? "?new=1" : ""}`)}`}
          className={cn(primaryButton, "mt-4")}
        >
          {authT.signIn}
        </Link>
      </div>
    );
  }

  const openTrip = openId ? trips.find((trip) => trip.id === openId) : undefined;
  if (openId && openTrip) {
    return <TripEditor key={openTrip.id} trip={openTrip} locale={locale} places={places} t={t} onBack={() => go("")} />;
  }
  if (openId && !loaded) return <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-sand" />;

  return (
    <div className="space-y-6">
      {openId && <p role="alert" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{t.tripNotFound}</p>}
      <NewTripForm locale={locale} t={t} startOpen={showNew} onCreated={(id) => go(`trip=${id}`)} />
      <TripList trips={trips} locale={locale} t={t} onOpen={(id) => go(`trip=${id}`)} loaded={loaded} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// The list of trips
// -----------------------------------------------------------------------------
function TripList({ trips, locale, t, onOpen, loaded }: { trips: TripSummary[]; locale: Locale; t: Dictionary["itinerary"]; onOpen: (id: string) => void; loaded: boolean }) {
  return (
    <section aria-labelledby="trips-heading">
      <h2 id="trips-heading" className="font-display text-xl font-semibold text-ink">
        {t.myTrips} <span className="text-muted">({trips.length})</span>
      </h2>
      {trips.length === 0 ? (
        loaded ? <p className="mt-3 rounded-2xl bg-sand p-6 text-muted">{t.noTrips}</p> : <div aria-hidden="true" className="mt-3 h-24 animate-pulse rounded-2xl bg-sand" />
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {trips.map((trip) => {
            const dates = formatTripDates(trip.startDate, trip.endDate, locale);
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => onOpen(trip.id)}
                  className="fy-lift flex w-full flex-col items-start gap-1 rounded-2xl bg-surface p-5 text-left ring-1 ring-line hover:ring-brand-500"
                >
                  <span className="font-display text-lg font-semibold text-ink">{trip.title}</span>
                  <span className="text-sm text-muted">{dates || t.noDates}</span>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                    {fill(t.placeCount, { count: trip.placeIds.length })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// "New trip": name + dates
// -----------------------------------------------------------------------------
function NewTripForm({ locale, t, startOpen, onCreated }: { locale: Locale; t: Dictionary["itinerary"]; startOpen: boolean; onCreated: (id: string) => void }) {
  const { addToTrip } = useSession();
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badRange = !!startDate && !!endDate && endDate < startDate;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (badRange) return;
    setBusy(true);
    setError(null);
    try {
      const id = await addToTrip({ newTitle: title.trim() || t.defaultTitle, startDate, endDate: endDate || startDate }, []);
      onCreated(id);
    } catch (err) {
      setError(fill(t.saveFailed, { message: (err as { message?: string }).message ?? "" }));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
        <span aria-hidden="true">＋</span>
        {t.newTrip}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="fy-pop space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line" lang={locale}>
      <h2 className="font-display text-xl font-semibold text-ink">{t.newTrip}</h2>
      <p className="text-sm text-muted">{t.newTripIntro}</p>
      <label className="block">
        <span className="text-sm font-medium text-ink">{t.tripTitle}</span>
        <input autoFocus maxLength={80} value={title} placeholder={t.defaultTitle} onChange={(e) => setTitle(e.target.value)} className={cn(field, "mt-1")} />
      </label>
      <DateRange t={t} startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      {error && <p role="alert" className="text-sm text-brand-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || badRange} className={primaryButton}>
          {busy ? t.creating : t.createTrip}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink hover:bg-sand">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

/** From / to dates. Picking a start date first makes "to" start there too. */
function DateRange({ t, startDate, endDate, onChange }: { t: Dictionary["itinerary"]; startDate: string; endDate: string; onChange: (start: string, end: string) => void }) {
  const badRange = !!startDate && !!endDate && endDate < startDate;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{t.dates}</legend>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted">{t.startDate}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange(e.target.value, endDate && endDate >= e.target.value ? endDate : e.target.value)}
            className={cn(field, "mt-1")}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">{t.endDate}</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            aria-invalid={badRange || undefined}
            onChange={(e) => onChange(startDate, e.target.value)}
            className={cn(field, "mt-1")}
          />
        </label>
      </div>
      {badRange && <p role="alert" className="mt-1 text-sm text-brand-700">{t.badDates}</p>}
    </fieldset>
  );
}

// -----------------------------------------------------------------------------
// One trip, open for editing
// -----------------------------------------------------------------------------
function TripEditor({ trip: summary, locale, places, t, onBack }: { trip: TripSummary; locale: Locale; places: MapDestination[]; t: Dictionary["itinerary"]; onBack: () => void }) {
  const { supabase, refreshSaved } = useSession();
  const [saved, setSaved] = useState<Trip | null>(null);
  const [draft, setDraft] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [toAdd, setToAdd] = useState("");

  // Reads the trip from the database. Returns data instead of setting state, so
  // callers decide when to apply it (and can ignore it if the page has moved on).
  const fetchTrip = useCallback(async (): Promise<{ trip: Trip } | { error: string } | null> => {
    if (!supabase) return null;
    const [tripRes, itemsRes] = await Promise.all([
      supabase.from("itineraries").select("title, start_date, end_date").eq("id", summary.id).maybeSingle(),
      supabase
        .from("itinerary_items")
        .select(`note, destination:destinations (${DESTINATION_COLUMNS})`)
        .eq("itinerary_id", summary.id)
        .order("position")
        .overrideTypes<ItemRow[], { merge: false }>(),
    ]);
    const error = tripRes.error ?? itemsRes.error;
    if (error) return { error: fill(t.loadFailed, { message: error.message }) };
    const stops = (itemsRes.data ?? []).flatMap((row): Stop[] => {
      const place = row.destination ? toMapDestination(row.destination, locale) : null;
      return place ? [{ place, note: row.note ?? "" }] : []; // skip places that were unpublished
    });
    return {
      trip: {
        title: tripRes.data?.title ?? "",
        startDate: tripRes.data?.start_date ?? "",
        endDate: tripRes.data?.end_date ?? "",
        stops,
      },
    };
  }, [supabase, summary.id, locale, t.loadFailed]);

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchTrip>>) => {
    if (!result) return;
    if ("error" in result) {
      setLoadError(result.error);
      return;
    }
    setSaved(result.trip);
    setDraft(result.trip);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchTrip().then((result) => active && apply(result));
    return () => {
      active = false;
    };
  }, [fetchTrip, apply]);

  // A place added to this trip elsewhere on the page (e.g. from a saved story)
  // is already stored: show it here too, without touching unsaved edits.
  // (Adjusts state during render when the trip's places change, as React
  // recommends instead of an effect.)
  const [seenIds, setSeenIds] = useState(summary.placeIds);
  if (seenIds !== summary.placeIds && saved && draft) {
    setSeenIds(summary.placeIds);
    const known = new Set([...saved.stops, ...draft.stops].map((s) => s.place.id));
    const newStops = summary.placeIds
      .filter((id) => !known.has(id))
      .flatMap((id): Stop[] => {
        const place = places.find((p) => p.id === id);
        return place ? [{ place, note: "" }] : [];
      });
    if (newStops.length > 0) {
      setSaved({ ...saved, stops: [...saved.stops, ...newStops] });
      setDraft({ ...draft, stops: [...draft.stops, ...newStops] });
    }
  }

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  // Ask before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t.leaveWarning;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, t.leaveWarning]);

  const backLink = (
    <button
      type="button"
      onClick={() => (!dirty || window.confirm(t.leaveWarning)) && onBack()}
      className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
    >
      <span aria-hidden="true">←</span> {t.allTrips}
    </button>
  );

  if (loadError) return <div className="space-y-4">{backLink}<p role="alert" className="rounded-2xl bg-brand-50 p-6 text-brand-700">{loadError}</p></div>;
  if (!draft) return <div className="space-y-4">{backLink}<div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-sand" /></div>;

  const update = (patch: Partial<Trip>) => {
    setDraft({ ...draft, ...patch });
    setFeedback(null);
  };

  function move(index: number, delta: -1 | 1) {
    const stops = [...draft!.stops];
    const [item] = stops.splice(index, 1);
    stops.splice(index + delta, 0, item);
    update({ stops });
    setAnnouncement(fill(t.moved, { name: item.place.name, position: index + delta + 1 }));
  }

  function remove(index: number) {
    const name = draft!.stops[index].place.name;
    update({ stops: draft!.stops.filter((_, i) => i !== index) });
    setAnnouncement(fill(t.removed, { name }));
  }

  function add() {
    const place = places.find((p) => p.id === toAdd);
    if (!place) return;
    update({ stops: [...draft!.stops, { place, note: "" }] });
    setToAdd("");
  }

  const badRange = !!draft.startDate && !!draft.endDate && draft.endDate < draft.startDate;

  async function save() {
    if (!supabase || !draft || badRange) return;
    setBusy(true);
    const { error } = await supabase.rpc("save_trip", {
      p_itinerary_id: summary.id,
      p_title: draft.title,
      p_start_date: draft.startDate || null,
      p_end_date: draft.endDate || draft.startDate || null,
      p_items: draft.stops.map((s) => ({ destination_id: s.place.id, note: s.note })),
    });
    setBusy(false);
    if (error) {
      setFeedback({ ok: false, text: fill(t.saveFailed, { message: error.message }) });
      return;
    }
    setFeedback({ ok: true, text: t.saved });
    apply(await fetchTrip()); // re-read what the database actually stored
    void refreshSaved(); // update the trip list and "In your trip" buttons
  }

  async function deleteTrip() {
    if (!supabase || !window.confirm(fill(t.deleteConfirm, { name: saved?.title ?? "" }))) return;
    setBusy(true);
    const { error } = await supabase.from("itineraries").delete().eq("id", summary.id);
    setBusy(false);
    if (error) {
      setFeedback({ ok: false, text: fill(t.saveFailed, { message: error.message }) });
      return;
    }
    setSaved(draft); // nothing unsaved any more, so leaving doesn't warn
    await refreshSaved();
    onBack();
  }

  const available = places.filter((p) => !draft.stops.some((s) => s.place.id === p.id));
  const routeUrl = googleMapsRoute(saved?.stops ?? []);

  return (
    <div className={cn("fy-pop space-y-6", dirty && "pb-24")}>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      {backLink}

      <div className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <label className="block">
          <span className="text-sm font-medium text-ink">{t.tripTitle}</span>
          <input maxLength={80} value={draft.title} onChange={(e) => update({ title: e.target.value })} className={cn(field, "mt-1 font-display text-lg")} />
        </label>
        <DateRange t={t} startDate={draft.startDate} endDate={draft.endDate} onChange={(startDate, endDate) => update({ startDate, endDate })} />
      </div>

      <section aria-labelledby="stops-heading">
        <h2 id="stops-heading" className="font-display text-xl font-semibold text-ink">
          {t.stops} <span className="text-muted">({draft.stops.length})</span>
        </h2>

        {draft.stops.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-sand p-6 text-muted">{t.empty}</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {draft.stops.map((stop, i) => (
              <li key={stop.place.id} className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line sm:gap-4 sm:p-4">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
                >
                  {i + 1}
                </span>
                {stop.place.image && (
                  <div className="relative hidden size-20 shrink-0 overflow-hidden rounded-xl sm:block">
                    <Image src={stop.place.image.src} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/${locale}/spots/${stop.place.slug}`} className="font-medium text-ink underline-offset-2 hover:text-brand-700 hover:underline">
                    {stop.place.name}
                  </Link>
                  <label className="mt-2 block">
                    <span className="sr-only">{`${t.note}: ${stop.place.name}`}</span>
                    <input
                      maxLength={300}
                      value={stop.note}
                      placeholder={t.notePlaceholder}
                      onChange={(e) =>
                        update({ stops: draft.stops.map((s, j) => (j === i ? { ...s, note: e.target.value } : s)) })
                      }
                      className="block w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand-500"
                    />
                  </label>
                </div>
                <div className="flex shrink-0 flex-col items-center sm:flex-row">
                  <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, -1)} aria-label={fill(t.moveUp, { name: stop.place.name })}>
                    <Chevron direction="up" />
                  </button>
                  <button type="button" className={iconButton} disabled={i === draft.stops.length - 1} onClick={() => move(i, 1)} aria-label={fill(t.moveDown, { name: stop.place.name })}>
                    <Chevron direction="down" />
                  </button>
                  <button type="button" className={iconButton} onClick={() => remove(i)} aria-label={fill(t.remove, { name: stop.place.name })}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {available.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-sm font-medium text-ink">{t.addPlace}</span>
            <select value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={cn(field, "mt-1")}>
              <option value="">{t.choosePlace}</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!toAdd}
            onClick={add}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-6 font-medium text-ink hover:border-brand-500 disabled:opacity-50"
          >
            {t.add}
          </button>
        </div>
      )}

      {routeUrl && !dirty && (
        <p>
          <a href={routeUrl} target="_blank" rel="noopener" className="font-medium text-brand-700 underline-offset-2 hover:underline">
            {t.openRoute} <span aria-hidden="true">↗</span>
          </a>
          {(saved?.stops.length ?? 0) > 10 && <span className="block text-xs text-muted">{t.routeNote}</span>}
        </p>
      )}

      {feedback && !dirty && (
        <p role={feedback.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", feedback.ok ? "bg-sand" : "bg-brand-50 text-brand-700")}>
          {feedback.text}
        </p>
      )}

      <p className="border-t border-line pt-4">
        <button type="button" disabled={busy} onClick={() => void deleteTrip()} className="text-sm font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50">
          {t.deleteTrip}
        </button>
      </p>

      {/* Save bar: pinned to the bottom of the screen while there are unsaved edits. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm text-muted">{t.unsaved}</p>
            {feedback && !feedback.ok && <p role="alert" className="w-full text-sm text-brand-700 sm:order-last">{feedback.text}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setFeedback(null);
                }}
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink hover:bg-sand"
              >
                {t.discard}
              </button>
              <button type="button" disabled={busy || badRange} onClick={() => void save()} className={cn(primaryButton, "px-6")}>
                {busy ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Walking route through the saved stops. Google's URL format allows up to 10 places. */
function googleMapsRoute(stops: Stop[]): string | null {
  const points = stops.slice(0, 10).map((s) => `${s.place.lat},${s.place.lng}`);
  if (points.length === 0) return null;
  const params = new URLSearchParams({ api: "1", destination: points[points.length - 1], travelmode: "walking" });
  if (points.length > 1) params.set("origin", points[0]);
  if (points.length > 2) params.set("waypoints", points.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d={direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}
