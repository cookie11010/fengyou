"use client";

import { useState } from "react";
import type { PublicStory } from "@/data/stories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { StoryCard } from "./StoryCard";
import { useStoryReactions } from "./StoryReactionsProvider";

type Props = {
  stories: PublicStory[];
  locale: Locale;
  t: Dictionary["stories"];
  saveLabels: Dictionary["save"];
  isExample: boolean;
};

/** The story grid, with an "All / Saved" switch. */
export function StoryList({ stories, locale, t, saveLabels, isExample }: Props) {
  const { mode, saved } = useStoryReactions();
  const [show, setShow] = useState<"all" | "saved">("all");
  const savedCount = stories.filter((s) => saved.has(s.id)).length;
  const visible = show === "saved" ? stories.filter((s) => saved.has(s.id)) : stories;
  const canFilter = mode === "db" || mode === "local";

  if (stories.length === 0) return <p className="rounded-2xl bg-sand p-6 text-muted">{t.empty}</p>;

  return (
    <div>
      {canFilter && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t.filterLabel} className="inline-flex rounded-full border border-line bg-surface p-1">
            {(["all", "saved"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={show === option}
                onClick={() => setShow(option)}
                className={cn(
                  "min-h-9 rounded-full px-4 text-sm font-medium",
                  show === option ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                )}
              >
                {option === "all" ? t.filterAll : fill(t.filterSaved, { count: savedCount })}
              </button>
            ))}
          </div>
          {mode === "local" && <p className="text-xs text-muted">{t.reactionsDemo}</p>}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-sand p-6 text-muted">{t.savedEmpty}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {visible.map((story) => (
            <li key={story.id}>
              <StoryCard story={story} locale={locale} t={t} saveLabels={saveLabels} isExample={isExample} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
