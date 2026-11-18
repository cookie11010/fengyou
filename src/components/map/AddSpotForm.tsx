"use client";

// "Add a spot": any signed-in user can put a new place on the map. The
// add_community_spot database function checks every field and creates the
// place, its text and its cover photo in one go.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshPublicContent } from "@/app/actions";
import { useSession } from "@/components/auth/SessionProvider";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { checkImage, IMAGE_TYPES, removeImage, uploadImage } from "@/lib/upload";
import type { SpotCategory } from "@/types/content";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sand" />,
});

type Point = { lat: number; lng: number };
type Props = {
  locale: Locale;
  categories: Record<SpotCategory, string>;
  t: Dictionary["spots"];
  storiesT: Dictionary["stories"]; // shared photo-picker wording
  authT: Dictionary["auth"];
};

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-brand-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium disabled:opacity-60";

export function AddSpotForm({ locale, categories, t, storiesT, authT }: Props) {
  const { status, supabase, user, saveToItinerary } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SpotCategory | "">("");
  const [summary, setSummary] = useState("");
  const [address, setAddress] = useState("");
  const [writtenIn, setWrittenIn] = useState<Locale>(locale);
  const [point, setPoint] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [addToTrip, setAddToTrip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Arriving from the Stories page's "Add it to the map" link: scroll here.
  useEffect(() => {
    if (window.location.hash === "#add-spot") document.getElementById("add-spot")?.scrollIntoView();
  }, []);

  if (status === "unavailable" || status === "loading") return null;

  if (status === "signed-out") {
    return (
      <Section t={t}>
        <p className="text-muted">{t.signInToAdd}</p>
        <Link
          href={`/${locale}/sign-in?next=/${locale}/spots%23add-spot`}
          className={cn(button, "mt-4 bg-brand-600 text-white hover:bg-brand-700")}
        >
          {authT.signIn}
        </Link>
      </Section>
    );
  }

  function pickPhoto(file: File | undefined) {
    setMessage(null);
    const problem = file ? checkImage(file) : null;
    if (!file || problem) {
      setPhoto(null);
      setFileKey((k) => k + 1);
      if (problem) setMessage({ ok: false, text: problem === "type" ? storiesT.photoWrongType : storiesT.photoTooBig });
      return;
    }
    setPhoto(file);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) return setMessage({ ok: false, text: t.locationFailed });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setMessage({ ok: false, text: t.locationFailed });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    if (!point) return setMessage({ ok: false, text: t.locationNeeded });
    setBusy(true);
    setMessage(null);

    let imagePath: string | null = null;
    try {
      if (photo) imagePath = await uploadImage(supabase, user.id, photo);
    } catch (err) {
      setBusy(false);
      setMessage({ ok: false, text: fill(t.addFailed, { message: (err as Error).message }) });
      return;
    }

    const { data: newId, error } = await supabase.rpc("add_community_spot", {
      p_name: name.trim(),
      p_summary: summary.trim(),
      p_category: category,
      p_latitude: point.lat,
      p_longitude: point.lng,
      p_locale: writtenIn,
      p_address: address.trim() || null,
      p_image_path: imagePath,
    });
    if (error) {
      await removeImage(supabase, imagePath);
      setBusy(false);
      setMessage({ ok: false, text: fill(t.addFailed, { message: error.message }) });
      return;
    }

    if (addToTrip) await saveToItinerary(newId as string).catch(() => undefined);
    await refreshPublicContent(["destinations"]);
    router.refresh();
    setBusy(false);
    setMessage({ ok: true, text: fill(t.added, { name: name.trim() }) });
    setName("");
    setCategory("");
    setSummary("");
    setAddress("");
    setPoint(null);
    setPhoto(null);
    setFileKey((k) => k + 1);
  }

  return (
    <Section t={t}>
      <p className="text-sm text-muted">{t.addIntro}</p>
      <form onSubmit={submit} className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">{t.name}</span>
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">{t.category}</span>
              <select required value={category} onChange={(e) => setCategory(e.target.value as SpotCategory)} className={field}>
                <option value="" />
                {(Object.keys(categories) as SpotCategory[]).map((c) => (
                  <option key={c} value={c}>{categories[c]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t.language}</span>
              <select value={writtenIn} onChange={(e) => setWrittenIn(e.target.value as Locale)} className={field}>
                {locales.map((l) => (
                  <option key={l} value={l}>{localeLabels[l]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">{t.summary}</span>
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              aria-describedby="spot-summary-hint"
              className={field}
            />
            <span id="spot-summary-hint" className="mt-1 block text-xs text-muted">{t.summaryHint}</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.address}</span>
            <input maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.photo}</span>
            <input
              key={fileKey}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              onChange={(e) => pickPhoto(e.target.files?.[0])}
              aria-describedby="spot-photo-hint"
              className="mt-1 block w-full text-sm text-muted file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-sand file:px-4 file:text-sm file:font-medium file:text-ink hover:file:bg-brand-50"
            />
            <span id="spot-photo-hint" className="mt-1 block text-xs text-muted">{storiesT.photoHint}</span>
          </label>
        </div>

        <div className="flex flex-col">
          <p className="text-sm font-medium">{t.location}</p>
          <p className="text-xs text-muted">{t.locationHint}</p>
          <div
            role="region"
            aria-label={t.pickerLabel}
            className="relative isolate mt-2 h-72 overflow-hidden rounded-2xl ring-1 ring-line lg:h-auto lg:flex-1"
          >
            <LocationPicker value={point} onChange={(p) => { setPoint(p); setMessage(null); }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className="text-xs text-muted">
              {point && fill(t.pickedAt, { lat: point.lat.toFixed(5), lng: point.lng.toFixed(5) })}
            </p>
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className={cn(button, "min-h-9 border border-line bg-surface px-4 text-ink hover:border-brand-500")}
            >
              {locating ? t.locating : t.useMyLocation}
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={addToTrip} onChange={(e) => setAddToTrip(e.target.checked)} className="size-4" />
            {t.addToTripToo}
          </label>
          <button type="submit" disabled={busy} className={cn(button, "bg-brand-600 text-white hover:bg-brand-700")}>
            {busy ? t.submitting : t.submit}
          </button>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", message.ok ? "bg-sand text-ink" : "bg-brand-50 text-brand-700")}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </Section>
  );
}

function Section({ t, children }: { t: Dictionary["spots"]; children: React.ReactNode }) {
  return (
    <section id="add-spot" aria-labelledby="add-spot-heading" className="scroll-mt-24 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 id="add-spot-heading" className="font-display text-xl font-semibold text-ink">{t.addTitle}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
