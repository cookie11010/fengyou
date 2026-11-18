"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { COMMENT_MAX, type StoryCommentsState } from "./useStoryComments";

type Props = {
  id: string; // matches the toggle button's aria-controls
  state: StoryCommentsState;
  storyTitle: string;
  locale: Locale;
  t: Dictionary["stories"];
};

/** The comment thread under a story card, opened by the "Comments" button. */
export function StoryComments({ id, state, storyTitle, locale, t }: Props) {
  const { list, loadState, mode, canPost, canModerate, isMine, sessionLoading } = state;
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(iso));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPosting(true);
    const ok = await state.post(draft);
    setPosting(false);
    setMessage({ ok, text: ok ? t.commentPosted : t.commentError });
    if (ok) setDraft("");
  }

  async function onDelete(commentId: string) {
    if (window.confirm(t.commentDeleteConfirm)) await state.remove(commentId);
  }

  const tooLong = draft.length > COMMENT_MAX;
  const inputId = `${id}-input`;

  return (
    <section id={id} aria-label={fill(t.commentsOn, { title: storyTitle })} className="mt-4 border-t border-line pt-4">
      {loadState === "loading" && !list && <p className="text-sm text-muted">{t.commentLoading}</p>}
      {loadState === "error" && <p className="text-sm text-red-700">{t.commentLoadError}</p>}

      {list && list.length === 0 && <p className="text-sm text-muted">{t.commentsEmpty}</p>}
      {list && list.length > 0 && (
        <ol className="space-y-3">
          {list.map((c) => {
            const mineHere = isMine(c);
            return (
              <li key={c.id} className={cn("rounded-xl bg-sand/60 px-4 py-3", c.hidden && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="font-semibold text-ink">
                    {mineHere ? t.commentYou : (c.authorName ?? t.commentSomeone)}
                  </span>
                  {c.isExample && <Badge className="bg-accent-400/20 text-ink">{t.exampleBadge}</Badge>}
                  {c.hidden && <Badge>{t.commentHidden}</Badge>}
                  <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
                </div>
                {/* Comments can be in any language, so let the browser work out the text direction. */}
                <p dir="auto" className="mt-1 whitespace-pre-line break-words text-sm text-ink">{c.body}</p>

                {(mineHere || (canModerate && mode === "db")) && (
                  <div className="mt-2 flex gap-3 text-xs">
                    {canModerate && mode === "db" && (
                      <button
                        type="button"
                        onClick={() => void state.setHidden(c.id, !c.hidden)}
                        className="font-medium text-brand-700 underline-offset-2 hover:underline"
                      >
                        {c.hidden ? t.commentUnhide : t.commentHide}
                      </button>
                    )}
                    {(mineHere || canModerate) && (
                      <button
                        type="button"
                        onClick={() => void onDelete(c.id)}
                        className="font-medium text-red-700 underline-offset-2 hover:underline"
                      >
                        {t.commentDelete}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canPost ? (
        <form onSubmit={onSubmit} className="mt-4">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {t.commentLabel}
          </label>
          <textarea
            id={inputId}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage(null);
            }}
            rows={3}
            placeholder={t.commentPlaceholder}
            aria-describedby={`${inputId}-hint`}
            aria-invalid={tooLong || undefined}
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/80"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p id={`${inputId}-hint`} className={cn("text-xs", tooLong ? "text-red-700" : "text-muted")}>
              {mode === "local" ? t.commentsDemo : t.commentRules} · {draft.length}/{COMMENT_MAX}
            </p>
            <button
              type="submit"
              disabled={posting || !draft.trim() || tooLong}
              className="min-h-10 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {posting ? t.commentPosting : t.commentPost}
            </button>
          </div>
          <p role="status" className={cn("mt-2 text-sm", message?.ok ? "text-brand-700" : "text-red-700")}>
            {message?.text}
          </p>
        </form>
      ) : (
        !sessionLoading && (
          <p className="mt-4 text-sm">
            <Link
              href={`/${locale}/sign-in?next=/${locale}/stories`}
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              {t.commentSignIn}
            </Link>
          </p>
        )
      )}
    </section>
  );
}
