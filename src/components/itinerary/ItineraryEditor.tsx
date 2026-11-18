"use client";

// The user's trip: reorder, remove, add places, write notes, rename, set a date.
// Edits stay local until "Save trip", which sends the whole list to the
// save_itinerary database function in one call, so a half-saved trip is impossible.
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { DESTINATION_COLUMNS, toMapDestination, type DestinationRow } from "@/lib/destinations";
import { fill } from "@/lib/format";
import type { MapDestination } from "@/types/content";

type Stop = { place: MapDestination; note: string };
type Trip = { title: string; date: string; stops: Stop[] };
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

export function ItineraryEditor({ locale, places, t, authT }: Props) {
  const { status, supabase, user, refreshSaved } = useSession();
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
    if (!supabase || !user) return null;
    const [tripRes, itemsRes] = await Promise.all([
      supabase.from("itineraries").select("title, trip_date").maybeSingle(),
      supabase
        .from("itinerary_items")
        .select(`note, destination:destinations (${DESTINATION_COLUMNS})`)
        .order("position")
        .overrideTypes<ItemRow[], { merge: false }>(),
    ]);
    const error = tripRes.error ?? itemsRes.error;
    if (error) return { error: fill(t.loadFailed, { message: error.message }) };
    const stops = (itemsRes.data ?? []).flatMap((row): Stop[] => {
      const place = row.destination ? toMapDestination(row.destination, locale) : null;
      return place ? [{ place, note: row.note ?? "" }] : []; // skip places that were unpublished
    });
    return { trip: { title: tripRes.data?.title ?? "", date: tripRes.data?.trip_date ?? "", stops } };
  }, [supabase, user, locale, t.loadFailed]);

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
    if (status !== "signed-in") return;
    let active = true;
    void fetchTrip().then((result) => active && apply(result));
    return () => {
      active = false;
    };
  }, [status, fetchTrip, apply]);

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

  if (status === "unavailable") return <p className="rounded-2xl bg-sand p-6 text-muted">{authT.unavailable}</p>;
  if (status === "loading" || (status === "signed-in" && !draft && !loadError)) {
    return <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-sand" />;
  }
  if (status === "signed-out") {
    return (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-muted">{t.signInPrompt}</p>
        <Link
          href={`/${locale}/sign-in?next=/${locale}/itinerary`}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {authT.signIn}
        </Link>
      </div>
    );
  }
  if (loadError || !draft) return <p role="alert" className="rounded-2xl bg-brand-50 p-6 text-brand-700">{loadError}</p>;

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

  async function save() {
    if (!supabase || !draft) return;
    setBusy(true);
    const { error } = await supabase.rpc("save_itinerary", {
      p_title: draft.title,
      p_trip_date: draft.date || null,
      p_items: draft.stops.map((s) => ({ destination_id: s.place.id, note: s.note })),
    });
    setBusy(false);
    if (error) {
      setFeedback({ ok: false, text: fill(t.saveFailed, { message: error.message }) });
      return;
    }
    setFeedback({ ok: true, text: t.saved });
    apply(await fetchTrip()); // re-read what the database actually stored
    void refreshSaved(); // update "In your trip" buttons elsewhere
  }

  const available = places.filter((p) => !draft.stops.some((s) => s.place.id === p.id));
  const routeUrl = googleMapsRoute(saved?.stops ?? []);

  return (
    <div className={cn("space-y-6", dirty && "pb-24")}>
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="block">
          <span className="text-sm font-medium text-ink">{t.tripTitle}</span>
          <input
            maxLength={80}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            className={cn(field, "mt-1")}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">{t.tripDate}</span>
          <input type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} className={cn(field, "mt-1")} />
        </label>
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
                  <p className="font-medium text-ink">{stop.place.name}</p>
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
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
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
