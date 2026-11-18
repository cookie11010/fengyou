"use client";

// Everything on the Stories page that depends on who is signed in:
//   anyone signed in   → share form (with an optional photo) + their own stories
//   editors (teachers) → also the queue of stories still waiting for review
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { refreshPublicContent } from "@/app/actions";
import { useSession } from "@/components/auth/SessionProvider";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/public-client";
import { checkImage, IMAGE_TYPES, removeImage, uploadImage } from "@/lib/upload";

type Place = { id: string; name: string };
type Status = "draft" | "in_review" | "published" | "archived";
type OwnStory = {
  id: string;
  title: string;
  status: Status;
  destination_id: string;
  created_at: string;
  image_path: string | null;
};
type QueueStory = OwnStory & { body: string; kind: "story" | "tip"; locale: string; author_id: string };

type Props = { locale: Locale; places: Place[]; t: Dictionary["stories"]; authT: Dictionary["auth"] };

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-brand-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium disabled:opacity-60";

export function StoryWorkspace({ locale, places, t, authT }: Props) {
  const { status, profile } = useSession();
  const role = profile?.role;

  if (status === "unavailable" || status === "loading") return null;

  if (status === "signed-out") {
    return (
      <Panel title={t.shareTitle}>
        <p className="text-muted">{t.signInToShare}</p>
        <Link
          href={`/${locale}/sign-in?next=/${locale}/stories`}
          className={cn(button, "mt-4 bg-brand-600 text-white hover:bg-brand-700")}
        >
          {authT.signIn}
        </Link>
      </Panel>
    );
  }

  const canReview = role === "editor" || role === "admin";

  return (
    <div className="space-y-6">
      {canReview && <ReviewQueue places={places} t={t} />}
      <ComposerAndMine locale={locale} places={places} t={t} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `panel-${title.replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 id={id} className="font-display text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const statusLabel = (t: Dictionary["stories"], s: Status) =>
  ({ draft: t.statusDraft, in_review: t.statusInReview, published: t.statusPublished, archived: t.statusArchived })[s];

/* ---------------- Share form + "My stories" ---------------- */

function ComposerAndMine({ locale, places, t }: { locale: Locale; places: Place[]; t: Dictionary["stories"] }) {
  const { supabase, user } = useSession();
  const router = useRouter();
  const [mine, setMine] = useState<OwnStory[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [kind, setKind] = useState<"story" | "tip">("story");
  const [writtenIn, setWrittenIn] = useState<Locale>(locale);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0); // changing it resets the file input
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchMine = useCallback(async (): Promise<OwnStory[]> => {
    if (!supabase || !user) return [];
    const { data } = await supabase
      .from("stories")
      .select("id, title, status, destination_id, created_at, image_path")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });
    return (data as OwnStory[]) ?? [];
  }, [supabase, user]);
  const loadMine = async () => setMine(await fetchMine());

  useEffect(() => {
    let active = true;
    void fetchMine().then((rows) => active && setMine(rows));
    return () => {
      active = false;
    };
  }, [fetchMine]);

  // Free the preview's memory when it's replaced or the form goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearPhoto() {
    setPhoto(null);
    setPreview(null);
    setFileKey((k) => k + 1);
  }

  function pickPhoto(file: File | undefined) {
    setMessage(null);
    if (!file) return clearPhoto();
    const problem = checkImage(file);
    if (problem) {
      clearPhoto();
      setMessage({ ok: false, text: problem === "type" ? t.photoWrongType : t.photoTooBig });
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setBusy(true);
    setMessage(null);

    let imagePath: string | null = null;
    try {
      if (photo) imagePath = await uploadImage(supabase, user.id, photo);
    } catch (err) {
      setBusy(false);
      setMessage({ ok: false, text: fill(t.submitFailed, { message: (err as Error).message }) });
      return;
    }

    const { error } = await supabase.from("stories").insert({
      author_id: user.id,
      destination_id: placeId,
      kind,
      locale: writtenIn,
      title: title.trim(),
      body: body.trim(),
      image_path: imagePath,
      status: "published",
    });
    if (error) {
      await removeImage(supabase, imagePath); // don't leave an unused file behind
      setBusy(false);
      setMessage({ ok: false, text: fill(t.submitFailed, { message: error.message }) });
      return;
    }

    // Show the new story in the list for everyone right away.
    await refreshPublicContent(["stories"]);
    router.refresh();
    setBusy(false);
    setMessage({ ok: true, text: t.submitted });
    setTitle("");
    setBody("");
    clearPhoto();
    void loadMine();
  }

  async function remove(story: OwnStory) {
    if (!supabase || !window.confirm(t.confirmDelete)) return;
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) return;
    await removeImage(supabase, story.image_path);
    if (story.status === "published") {
      await refreshPublicContent(["stories"]);
      router.refresh();
    }
    void loadMine();
  }

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? "";

  return (
    <>
      <Panel title={t.shareTitle}>
        <p className="text-sm text-muted">{t.shareIntro}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="block">
              <span className="text-sm font-medium">{t.place}</span>
              <select required value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={field}>
                <option value="">{t.choosePlace}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <Link
              href={`/${locale}/spots#add-spot`}
              className="mt-1 inline-block text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              {t.placeMissing}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">{t.kind}</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as "story" | "tip")} className={field}>
                <option value="story">{t.kindStory}</option>
                <option value="tip">{t.kindTip}</option>
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
            <span className="text-sm font-medium">{t.storyTitle}</span>
            <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.body}</span>
            <textarea
              required
              minLength={20}
              maxLength={5000}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-describedby="story-body-hint"
              className={field}
            />
            <span id="story-body-hint" className="mt-1 block text-xs text-muted">{t.bodyHint}</span>
          </label>

          <div>
            <label className="block">
              <span className="text-sm font-medium">{t.photo}</span>
              <input
                key={fileKey}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                onChange={(e) => pickPhoto(e.target.files?.[0])}
                aria-describedby="story-photo-hint"
                className="mt-1 block w-full text-sm text-muted file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-sand file:px-4 file:text-sm file:font-medium file:text-ink hover:file:bg-brand-50"
              />
              <span id="story-photo-hint" className="mt-1 block text-xs text-muted">{t.photoHint}</span>
            </label>
            {preview && (
              <div className="mt-3 flex items-start gap-3">
                {/* A local blob: URL, so a plain <img> rather than next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={t.photoPreview} className="h-24 w-32 rounded-xl object-cover ring-1 ring-line" />
                <button type="button" onClick={clearPhoto} className="text-sm text-brand-700 hover:underline">
                  {t.photoRemove}
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={busy} className={cn(button, "bg-brand-600 text-white hover:bg-brand-700")}>
            {busy ? t.submitting : t.submit}
          </button>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", message.ok ? "bg-sand text-ink" : "bg-brand-50 text-brand-700")}>
              {message.text}
            </p>
          )}
        </form>
      </Panel>

      {mine.length > 0 && (
        <Panel title={t.myStories}>
          <ul className="divide-y divide-line">
            {mine.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                {s.image_path && (
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                    <Image src={mediaUrl(s.image_path)} alt="" fill sizes="48px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-muted">{placeName(s.destination_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", s.status === "published" ? "bg-brand-50 text-brand-700" : "bg-sand text-muted")}>
                    {statusLabel(t, s.status)}
                  </span>
                  <button type="button" onClick={() => void remove(s)} className="text-sm text-brand-700 hover:underline">
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

/* ---------------- Editor: review queue ---------------- */
// New stories are published straight away now, so this only holds stories
// sent in before that change (or drafts an editor moved back for review).

function ReviewQueue({ places, t }: { places: Place[]; t: Dictionary["stories"] }) {
  const { supabase } = useSession();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueStory[]>([]);
  const [authors, setAuthors] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!supabase) return { rows: [] as QueueStory[], names: new Map<string, string>() };
    const { data } = await supabase
      .from("stories")
      .select("id, title, body, kind, locale, status, destination_id, author_id, created_at, image_path")
      .eq("status", "in_review")
      .order("created_at");
    const rows = (data as QueueStory[]) ?? [];
    const ids = [...new Set(rows.map((r) => r.author_id))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
    return { rows, names };
  }, [supabase]);
  const load = async () => {
    const { rows, names } = await fetchQueue();
    setQueue(rows);
    setAuthors(names);
  };

  useEffect(() => {
    let active = true;
    void fetchQueue().then((result) => {
      if (active) {
        setQueue(result.rows);
        setAuthors(result.names);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchQueue]);

  async function decide(id: string, status: "published" | "archived") {
    if (!supabase) return;
    const { error } = await supabase.from("stories").update({ status }).eq("id", id);
    if (!error && status === "published") {
      await refreshPublicContent(["stories"]);
      router.refresh();
      setNotice(t.approved);
    }
    void load();
  }

  if (queue.length === 0 && !notice) return null; // nothing to review: keep the sidebar short

  return (
    <Panel title={t.reviewQueue}>
      {notice && <p role="status" className="mb-3 rounded-xl bg-sand px-4 py-2 text-sm">{notice}</p>}
      {queue.length === 0 ? (
        <p className="text-muted">{t.reviewEmpty}</p>
      ) : (
        <ul className="space-y-4">
          {queue.map((s) => (
            <li key={s.id} className="rounded-xl bg-canvas p-4 ring-1 ring-line">
              <p className="text-xs text-muted">
                {places.find((p) => p.id === s.destination_id)?.name} · {authors.get(s.author_id) ?? "—"} · {s.kind === "tip" ? t.kindTip : t.kindStory}
              </p>
              <div lang={s.locale}>
                <p className="mt-1 font-medium text-ink">{s.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{s.body}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void decide(s.id, "published")} className={cn(button, "bg-brand-600 text-white hover:bg-brand-700")}>
                  {t.approve}
                </button>
                <button type="button" onClick={() => void decide(s.id, "archived")} className={cn(button, "border border-line bg-surface text-ink hover:border-brand-500")}>
                  {t.reject}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
