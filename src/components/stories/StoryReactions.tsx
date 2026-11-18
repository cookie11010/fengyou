"use client";

import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { useStoryReactions } from "./StoryReactionsProvider";

type Props = { storyId: string; storyTitle: string; baseLikes: number; t: Dictionary["stories"] };

const button =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 transition-colors";

/** Like (public count) and Save (private bookmark) buttons for one story. */
export function StoryReactions({ storyId, storyTitle, baseLikes, t }: Props) {
  const { mode, liked, saved, likeDelta, toggle } = useStoryReactions();
  const isLiked = liked.has(storyId);
  const isSaved = saved.has(storyId);
  const count = Math.max(0, baseLikes + likeDelta(storyId));
  const signedOut = mode === "signed-out";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={isLiked}
        // e.g. "Like: Sunset at the gate". The count is announced separately below.
        aria-label={`${isLiked ? t.unlike : t.like}: ${storyTitle}`}
        title={signedOut ? t.signInToReact : undefined}
        disabled={mode === "loading"}
        onClick={() => void toggle("like", storyId)}
        className={cn(
          button,
          isLiked ? "bg-brand-50 text-brand-700 ring-brand-500" : "bg-surface text-ink ring-line hover:ring-brand-500",
        )}
      >
        <HeartIcon filled={isLiked} />
        <span aria-hidden="true">{count}</span>
      </button>
      <span className="sr-only" aria-live="polite">{count === 1 ? t.likeCountOne : fill(t.likeCount, { count })}</span>

      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={`${t.save}: ${storyTitle}`}
        title={signedOut ? t.signInToReact : undefined}
        disabled={mode === "loading"}
        onClick={() => void toggle("save", storyId)}
        className={cn(
          button,
          isSaved ? "bg-brand-50 text-brand-700 ring-brand-500" : "bg-surface text-ink ring-line hover:ring-brand-500",
        )}
      >
        <BookmarkIcon filled={isSaved} />
        <span>{isSaved ? t.saved : t.save}</span>
      </button>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 6.9 4.5c2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 3.6 0 5.9 3.5 4.4 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}
