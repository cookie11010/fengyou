"use client";

// Everything on the Stories page that depends on who is signed in:
//   contributors (students) → share form + their own stories
//   editors (teachers)      → review queue
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";

type Place = { id: string; name: string };
type Status = "draft" | "in_review" | "published" | "archived";
type OwnStory = { id: string; title: string; status: Status; destination_id: string; created_at: string };
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

  if (!role) return null; // profile still loading
  const canWrite = role === "contributor" || role === "editor" || role === "admin";
  const canReview = role === "editor" || role === "admin";

  return (
    <div className="space-y-6">
      {canReview && <ReviewQueue places={places} t={t} />}
      {canWrite ? (
        <ComposerAndMine locale={locale} places={places} t={t} />
      ) : (
        <Panel title={t.shareTitle}>
          <p className="text-muted">{t.contributorsOnly}</p>
        </Panel>
      )}
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

/* ---------------- Student: share form + "My stories" ---------------- */

function ComposerAndMine({ locale, places, t }: { locale: Locale; places: Place[]; t: Dictionary["stories"] }) {
  const { supabase, user } = useSession();
  const [mine, setMine] = useState<OwnStory[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [kind, setKind] = useState<"story" | "tip">("story");
  const [writtenIn, setWrittenIn] = useState<Locale>(locale);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchMine = useCallback(async (): Promise<OwnStory[]> => {
    if (!supabase || !user) return [];
    const { data } = await supabase
      .from("stories")
      .select("id, title, status, destination_id, created_at")
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("stories").insert({
      author_id: user.id,
      destination_id: placeId,
      kind,
      locale: writtenIn,
      title: title.trim(),
      body: body.trim(),
      status: "in_review",
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: fill(t.submitFailed, { message: error.message }) });
      return;
    }
    setMessage({ ok: true, text: t.submitted });
    setTitle("");
    setBody("");
    void loadMine();
  }

  async function remove(id: string) {
    if (!supabase || !window.confirm(t.confirmDelete)) return;
    await supabase.from("stories").delete().eq("id", id);
    void loadMine();
  }

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? "";

  return (
    <>
      <Panel title={t.shareTitle}>
        <p className="text-sm text-muted">{t.shareIntro}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">{t.place}</span>
            <select required value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={field}>
              <option value="">{t.choosePlace}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
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
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-muted">{placeName(s.destination_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", s.status === "published" ? "bg-brand-50 text-brand-700" : "bg-sand text-muted")}>
                    {statusLabel(t, s.status)}
                  </span>
                  <button type="button" onClick={() => void remove(s.id)} className="text-sm text-brand-700 hover:underline">
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

function ReviewQueue({ places, t }: { places: Place[]; t: Dictionary["stories"] }) {
  const { supabase } = useSession();
  const [queue, setQueue] = useState<QueueStory[]>([]);
  const [authors, setAuthors] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!supabase) return { rows: [] as QueueStory[], names: new Map<string, string>() };
    const { data } = await supabase
      .from("stories")
      .select("id, title, body, kind, locale, status, destination_id, author_id, created_at")
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
  const applyQueue = ({ rows, names }: Awaited<ReturnType<typeof fetchQueue>>) => {
    setQueue(rows);
    setAuthors(names);
  };
  const load = async () => applyQueue(await fetchQueue());

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
    if (!error && status === "published") setNotice(t.approved);
    void load();
  }

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
