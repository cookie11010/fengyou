"use client";

// The two community sections on a place's page:
//   "What to eat here"  food tips from students and visitors
//   "Discussion"        questions and answers about the place
// Both read from the same list of posts, loaded once.
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { LIMITS, usePlacePosts, type PlacePost, type PlacePostsState } from "./usePlacePosts";

type Props = {
  destinationId: string;
  slug: string;
  placeName: string;
  locale: Locale;
  t: Dictionary["place"];
  /** Shown between the food tips and the discussion (the server-rendered stories). */
  storiesSlot?: ReactNode;
};

const input = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/80";
const submit = "min-h-10 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

export function PlaceTalk({ destinationId, slug, placeName, locale, t, storiesSlot }: Props) {
  const state = usePlacePosts(destinationId);
  const signInHref = `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/spots/${slug}`)}`;
  const food = state.posts?.filter((p) => p.kind === "food") ?? [];
  const comments = state.posts?.filter((p) => p.kind === "comment") ?? [];

  return (
    <>
      <Section id="food" title={t.foodTitle} intro={t.foodIntro} count={state.posts ? food.filter((p) => !p.hidden).length : null}>
        <Status state={state} t={t} />
        {state.posts && food.length === 0 && <p className="rounded-2xl bg-sand p-5 text-sm text-muted">{t.foodEmpty}</p>}
        {food.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {food.map((p) => (
              <li key={p.id} className={cn("fy-pop flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line", p.hidden && "opacity-60")}>
                <p className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-xl leading-none">🍜</span>
                  <span dir="auto" className="font-display text-lg font-semibold leading-snug text-ink">{p.dish}</span>
                </p>
                {p.body && <p dir="auto" className="mt-2 whitespace-pre-line break-words text-sm text-muted">{p.body}</p>}
                <PostFooter post={p} state={state} locale={locale} t={t} by={t.recommendedBy} />
              </li>
            ))}
          </ul>
        )}
        {state.canPost ? <FoodForm state={state} placeName={placeName} t={t} /> : <SignInPrompt status={state.status} href={signInHref} text={t.signInToRecommend} t={t} />}
      </Section>

      {storiesSlot}

      <Section id="discussion" title={t.discussionTitle} intro={t.discussionIntro} count={state.posts ? comments.filter((p) => !p.hidden).length : null}>
        <Status state={state} t={t} />
        {state.posts && comments.length === 0 && <p className="rounded-2xl bg-sand p-5 text-sm text-muted">{t.commentsEmpty}</p>}
        {comments.length > 0 && (
          <ol className="space-y-3">
            {comments.map((p) => (
              <li key={p.id} className={cn("fy-pop rounded-2xl bg-surface px-4 py-3 ring-1 ring-line", p.hidden && "opacity-60")}>
                <p dir="auto" className="whitespace-pre-line break-words text-sm text-ink">{p.body}</p>
                <PostFooter post={p} state={state} locale={locale} t={t} by={t.postedBy} />
              </li>
            ))}
          </ol>
        )}
        {state.canPost ? <CommentForm state={state} t={t} /> : <SignInPrompt status={state.status} href={signInHref} text={t.signInToComment} t={t} />}
      </Section>
    </>
  );
}

function Section({ id, title, intro, count, children }: { id: string; title: string; intro: string; count: number | null; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="font-display text-2xl font-semibold text-ink">
        {title} {count !== null && <span className="text-muted">({count})</span>}
      </h2>
      <p className="mt-1 text-sm text-muted">{intro}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Status({ state, t }: { state: PlacePostsState; t: Dictionary["place"] }) {
  if (state.status === "unavailable") return <p className="rounded-2xl bg-sand p-5 text-sm text-muted">{t.needsDatabase}</p>;
  if (state.loadError) return <p role="alert" className="text-sm text-red-700">{t.loadError}</p>;
  if (!state.posts) return <div aria-hidden="true" className="h-20 animate-pulse rounded-2xl bg-sand" />;
  return null;
}

function PostFooter({ post, state, locale, t, by }: { post: PlacePost; state: PlacePostsState; locale: Locale; t: Dictionary["place"]; by: string }) {
  const mine = state.isMine(post);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date(post.createdAt));
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
      <span>
        {by.replace("{name}", mine ? t.you : (post.authorName ?? t.someone))} · <time dateTime={post.createdAt}>{date}</time>
      </span>
      {post.hidden && <Badge>{t.hidden}</Badge>}
      {state.canModerate && (
        <button type="button" onClick={() => void state.setHidden(post.id, !post.hidden)} className="font-medium text-brand-700 underline-offset-2 hover:underline">
          {post.hidden ? t.unhide : t.hide}
        </button>
      )}
      {(mine || state.canModerate) && (
        <button
          type="button"
          onClick={() => window.confirm(t.deleteConfirm) && void state.remove(post.id)}
          className="font-medium text-red-700 underline-offset-2 hover:underline"
        >
          {t.delete}
        </button>
      )}
    </div>
  );
}

function SignInPrompt({ status, href, text, t }: { status: PlacePostsState["status"]; href: string; text: string; t: Dictionary["place"] }) {
  if (status !== "signed-out") return null;
  return (
    <p className="text-sm">
      <Link href={href} className="font-medium text-brand-700 underline underline-offset-2">{text}</Link>
      <span className="text-muted"> · {t.signInWhy}</span>
    </p>
  );
}

function FoodForm({ state, placeName, t }: { state: PlacePostsState; placeName: string; t: Dictionary["place"] }) {
  const [dish, setDish] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const error = await state.post("food", { dish, body: note });
    setBusy(false);
    setMessage(error ? { ok: false, text: t.postFailed.replace("{message}", error) } : { ok: true, text: t.foodPosted });
    if (!error) {
      setDish("");
      setNote("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
      <p className="text-sm font-medium text-ink">{t.foodFormTitle.replace("{place}", placeName)}</p>
      <label className="mt-3 block text-sm font-medium text-ink">
        {t.dish}
        <input required maxLength={LIMITS.dish} value={dish} placeholder={t.dishPlaceholder} onChange={(e) => { setDish(e.target.value); setMessage(null); }} className={input} />
      </label>
      <label className="mt-3 block text-sm font-medium text-ink">
        {t.foodNote}
        <textarea rows={2} maxLength={LIMITS.foodNote} value={note} placeholder={t.foodNotePlaceholder} onChange={(e) => { setNote(e.target.value); setMessage(null); }} className={input} />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t.rules}</p>
        <button type="submit" disabled={busy || !dish.trim()} className={submit}>{busy ? t.posting : t.recommend}</button>
      </div>
      <p role="status" className={cn("mt-2 text-sm", message?.ok ? "text-brand-700" : "text-red-700")}>{message?.text}</p>
    </form>
  );
}

function CommentForm({ state, t }: { state: PlacePostsState; t: Dictionary["place"] }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const tooLong = body.length > LIMITS.comment;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const error = await state.post("comment", { body });
    setBusy(false);
    setMessage(error ? { ok: false, text: t.postFailed.replace("{message}", error) } : { ok: true, text: t.commentPosted });
    if (!error) setBody("");
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="block text-sm font-medium text-ink">
        {t.commentLabel}
        <textarea
          rows={3}
          value={body}
          placeholder={t.commentPlaceholder}
          aria-invalid={tooLong || undefined}
          onChange={(e) => { setBody(e.target.value); setMessage(null); }}
          className={input}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-xs", tooLong ? "text-red-700" : "text-muted")}>{t.rules} · {body.length}/{LIMITS.comment}</p>
        <button type="submit" disabled={busy || !body.trim() || tooLong} className={submit}>{busy ? t.posting : t.post}</button>
      </div>
      <p role="status" className={cn("mt-2 text-sm", message?.ok ? "text-brand-700" : "text-red-700")}>{message?.text}</p>
    </form>
  );
}
