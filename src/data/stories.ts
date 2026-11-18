// Published student stories, for the public Stories page.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { DESTINATION_COLUMNS, toMapDestination, type DestinationRow } from "@/lib/destinations";
import { getPublicSupabase, mediaUrl } from "@/lib/supabase/public-client";
import type { MapDestination } from "@/types/content";
import { exampleStories } from "./example-stories";
import { sampleDestinations } from "./map";

export type PublicStory = {
  id: string;
  kind: "story" | "tip";
  locale: string; // the language it was written in
  title: string;
  body: string;
  publishedAt: string;
  authorId: string | null;
  authorName: string | null;
  likeCount: number;
  commentCount: number;
  place: MapDestination;
  /** The photo the writer attached, if any (otherwise the card shows the place's photo). */
  image?: { src: string; alt: string };
  /** Only on example stories: developer-written comments to show the feature. */
  exampleComments?: StoryComment[];
};

/** One comment, as the comment list shows it. */
export type StoryComment = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
  hidden?: boolean; // only editors ever see hidden comments
  isExample?: boolean;
};

type StoryRow = {
  id: string;
  kind: "story" | "tip";
  locale: string;
  title: string;
  body: string;
  published_at: string;
  author_id: string;
  like_count: number;
  comment_count: number;
  image_path: string | null;
  destination: DestinationRow | null;
};

/** "example" = Supabase isn't connected, so the stories are labelled examples. */
export type StoriesResult = { status: "ok" | "example" | "error"; stories: PublicStory[] };

export async function getPublishedStories(locale: Locale): Promise<StoriesResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("stories"); // posting a story refreshes this right away (see src/app/actions.ts)

  const supabase = getPublicSupabase();
  if (!supabase) return { status: "example", stories: buildExampleStories(locale) };

  const query = (columns: string) =>
    supabase
      .from("stories")
      .select(`${columns}, destination:destinations (${DESTINATION_COLUMNS})`)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60)
      .overrideTypes<StoryRow[], { merge: false }>();
  const columns = "id, kind, locale, title, body, published_at, author_id, like_count, comment_count";

  let { data, error } = await query(`${columns}, image_path`);
  // Until the 20261118120000 migration is applied, stories have no photo
  // column. Keep showing stories (without photos) instead of an error.
  if (error?.message.includes("image_path")) ({ data, error } = await query(columns));

  // Don't take the whole page (or the build) down if the database is unreachable.
  if (error) {
    console.error("Could not load stories:", error.message);
    return { status: "error", stories: [] };
  }

  // Author names come from the public author_profiles view (name + avatar only).
  const authorIds = [...new Set((data ?? []).map((s) => s.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("author_profiles").select("id, display_name").in("id", authorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name as string]));

  const stories = (data ?? []).flatMap((row): PublicStory[] => {
    const place = row.destination ? toMapDestination(row.destination, locale) : null;
    if (!place) return [];
    return [
      {
        id: row.id,
        kind: row.kind,
        locale: row.locale,
        title: row.title,
        body: row.body,
        publishedAt: row.published_at,
        authorId: row.author_id,
        authorName: nameById.get(row.author_id) ?? null,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        image: row.image_path ? { src: mediaUrl(row.image_path), alt: row.title } : undefined,
        place,
      },
    ];
  });

  return { status: "ok", stories };
}

function buildExampleStories(locale: Locale): PublicStory[] {
  const places = sampleDestinations(locale);
  const newestFirst = [...exampleStories].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return newestFirst.flatMap((story) => {
    const place = places.find((p) => p.slug === story.placeSlug);
    if (!place) return [];
    const comments = (story.comments ?? []).map(
      (c, i): StoryComment => ({
        id: `${story.id}-c${i}`,
        body: c.body,
        createdAt: c.createdAt,
        authorId: null,
        authorName: c.authorName[locale],
        isExample: true,
      }),
    );
    return [
      {
        id: story.id,
        kind: story.kind,
        locale: story.locale,
        title: story.title,
        body: story.body,
        publishedAt: story.publishedAt,
        authorId: null,
        authorName: null, // the page shows "Example" instead of a student's name
        likeCount: 0, // no made-up popularity
        commentCount: comments.length,
        exampleComments: comments,
        place,
      },
    ];
  });
}
