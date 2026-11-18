"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { SaveToItineraryButton } from "@/components/itinerary/SaveToItineraryButton";
import { Badge } from "@/components/ui/Badge";
import { localeLabels, hasLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PublicStory } from "@/data/stories";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { StoryComments } from "./StoryComments";
import { StoryOwnerActions } from "./StoryOwnerActions";
import { StoryReactions } from "./StoryReactions";
import { useStoryComments } from "./useStoryComments";

type Props = {
  story: PublicStory;
  locale: Locale;
  t: Dictionary["stories"];
  saveLabels: Dictionary["save"];
  isExample?: boolean; // developer-written example, not a real student's story
};

export function StoryCard({ story, locale, t, saveLabels, isExample = false }: Props) {
  // Fixed to Taiwan time so the server and the visitor's browser show the same date.
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(
    new Date(story.publishedAt),
  );
  const writtenIn = hasLocale(story.locale) ? localeLabels[story.locale] : story.locale;
  const comments = useStoryComments(story);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const panelId = useId();
  // The writer's own photos, else the place's photo.
  const photos = story.images.length > 0 ? story.images : story.place.image ? [story.place.image] : [];
  const [shown, setShown] = useState(0);
  const photo = photos[Math.min(shown, photos.length - 1)];

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening) void comments.load(); // fetch fresh each time it's opened
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {photo && (
        <div className="relative aspect-[16/9]">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-2 flex gap-1.5">
              {photos.map((p, i) => (
                <button
                  key={p.src}
                  type="button"
                  aria-pressed={i === shown}
                  aria-label={fill(t.photoShow, { number: i + 1, total: photos.length })}
                  onClick={() => setShown(i)}
                  className={cn(
                    "relative size-11 overflow-hidden rounded-lg ring-2",
                    i === shown ? "ring-white" : "ring-white/40 opacity-80 hover:opacity-100",
                  )}
                >
                  <Image src={p.src} alt="" fill sizes="44px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{story.kind === "tip" ? t.kindTip : t.kindStory}</Badge>
          {isExample && <Badge className="bg-accent-400/20 text-ink">{t.exampleBadge}</Badge>}
          <span className="text-sm font-medium text-brand-700">{fill(t.about, { place: story.place.name })}</span>
        </div>

        {/* The story keeps its own language, whatever language the page is in. */}
        <div lang={story.locale} className="mt-3 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">{story.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{story.body}</p>
        </div>

        <p className="mt-4 text-xs text-muted">
          {story.authorName && <>{fill(t.by, { name: story.authorName })} · </>}
          <time dateTime={story.publishedAt}>{date}</time>
          {story.locale !== locale && <> · {fill(t.writtenIn, { language: writtenIn })}</>}
          {!isExample && (
            <>
              {" "}
              <StoryOwnerActions storyId={story.id} authorId={story.authorId} t={t} />
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <StoryReactions storyId={story.id} storyTitle={story.title} baseLikes={story.likeCount} t={t} />
            <button
              type="button"
              aria-expanded={commentsOpen}
              aria-controls={panelId}
              aria-label={`${fill(t.commentsOn, { title: story.title })} (${comments.count})`}
              onClick={toggleComments}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 transition-colors",
                commentsOpen ? "bg-brand-50 text-brand-700 ring-brand-500" : "bg-surface text-ink ring-line hover:ring-brand-500",
              )}
            >
              <CommentIcon />
              <span aria-hidden="true">{comments.count}</span>
            </button>
          </div>
          <SaveToItineraryButton destinationId={story.place.id} placeName={story.place.name} locale={locale} t={saveLabels} />
        </div>

        {commentsOpen && <StoryComments id={panelId} state={comments} storyTitle={story.title} locale={locale} t={t} />}
      </div>
    </article>
  );
}

function CommentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
    </svg>
  );
}
