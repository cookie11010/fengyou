"use client";

// On the My trip page: the stories this user saved, each with a button that
// adds the story's place to the trip.
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { DESTINATION_COLUMNS, toMapDestination, type DestinationRow } from "@/lib/destinations";
import { fill } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/public-client";
import type { MapDestination } from "@/types/content";
import { SaveToItineraryButton } from "./SaveToItineraryButton";

type Row = {
  story: {
    id: string;
    title: string;
    body: string;
    locale: string;
    image_path: string | null;
    destination: DestinationRow | null;
  } | null;
};
type Saved = { id: string; title: string; body: string; locale: string; image?: string; place: MapDestination };

type Props = {
  locale: Locale;
  t: Dictionary["itinerary"];
  storiesT: Dictionary["stories"];
  saveT: Dictionary["save"];
};

export function SavedStories({ locale, t, storiesT, saveT }: Props) {
  const { status, supabase, user } = useSession();
  const [saved, setSaved] = useState<Saved[] | null>(null);

  const fetchSaved = useCallback(async (): Promise<Saved[]> => {
    if (!supabase || !user) return [];
    // RLS returns only this user's reactions, and only published stories.
    const { data } = await supabase
      .from("story_reactions")
      .select(`created_at, story:stories (id, title, body, locale, image_path, destination:destinations (${DESTINATION_COLUMNS}))`)
      .eq("kind", "save")
      .order("created_at", { ascending: false })
      .overrideTypes<Row[], { merge: false }>();
    return (data ?? []).flatMap((r): Saved[] => {
      const s = r.story;
      const place = s?.destination ? toMapDestination(s.destination, locale) : null;
      if (!s || !place) return [];
      return [{ id: s.id, title: s.title, body: s.body, locale: s.locale, image: s.image_path ? mediaUrl(s.image_path) : place.image?.src, place }];
    });
  }, [supabase, user, locale]);

  useEffect(() => {
    if (status !== "signed-in") return;
    let active = true;
    void fetchSaved().then((rows) => active && setSaved(rows));
    return () => {
      active = false;
    };
  }, [status, fetchSaved]);

  async function unsave(id: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("story_reactions").delete().match({ user_id: user.id, story_id: id, kind: "save" });
    if (!error) setSaved((prev) => prev?.filter((s) => s.id !== id) ?? null);
  }

  if (status !== "signed-in" || saved === null) return null;

  return (
    <section aria-labelledby="saved-stories-heading">
      <h2 id="saved-stories-heading" className="font-display text-xl font-semibold text-ink">
        {t.savedStories} <span className="text-muted">({saved.length})</span>
      </h2>
      {saved.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-sand p-6 text-muted">
          {t.savedStoriesEmpty}{" "}
          <Link href={`/${locale}/stories`} className="font-medium text-brand-700 underline underline-offset-2">
            {t.browseStories}
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">{t.savedStoriesIntro}</p>
          <ul className="mt-3 space-y-3">
            {saved.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line sm:gap-4 sm:p-4">
                {s.image && (
                  <div className="relative hidden size-20 shrink-0 overflow-hidden rounded-xl sm:block">
                    <Image src={s.image} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-brand-700">{fill(storiesT.about, { place: s.place.name })}</p>
                  <div lang={s.locale}>
                    <p className="font-medium text-ink">{s.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{s.body}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <SaveToItineraryButton destinationId={s.place.id} placeName={s.place.name} locale={locale} t={saveT} />
                    <button type="button" onClick={() => void unsave(s.id)} className="text-sm text-muted hover:text-ink hover:underline">
                      {t.unsaveStory}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
