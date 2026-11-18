"use client";

// The comments on one story: loading them, posting, deleting and (for
// editors) hiding. Works in two modes, like the like/save buttons:
//   "db"     Supabase is connected: anyone can read, signed-in users can post
//   "local"  Supabase isn't connected (example stories): your comments are
//            kept in this browser so the feature can be tried out
import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@/components/auth/SessionProvider";
import type { PublicStory, StoryComment } from "@/data/stories";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

export const COMMENT_MAX = 1000; // same limit as the database check

type LocalComment = { id: string; body: string; createdAt: string };
const localComments = createLocalStore("fengyou-story-comments", (v) =>
  v && typeof v === "object" ? (v as Record<string, LocalComment[]>) : {},
);

type CommentRow = { id: string; body: string; created_at: string; author_id: string; status: "visible" | "hidden" };

async function fetchComments(supabase: SupabaseClient, storyId: string): Promise<StoryComment[] | null> {
  // RLS decides what comes back: visible comments for everyone, plus hidden
  // ones for editors.
  const { data, error } = await supabase
    .from("story_comments")
    .select("id, body, created_at, author_id, status")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true })
    .limit(200)
    .overrideTypes<CommentRow[], { merge: false }>();
  if (error) return null;

  // Names come from the public author_profiles view (name only, nothing private).
  const ids = [...new Set((data ?? []).map((c) => c.author_id))];
  const { data: authors } = ids.length
    ? await supabase.from("author_profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id as string, a.display_name as string]));

  return (data ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    authorId: c.author_id,
    authorName: nameById.get(c.author_id) ?? null,
    hidden: c.status === "hidden",
  }));
}

export function useStoryComments(story: Pick<PublicStory, "id" | "commentCount" | "exampleComments">) {
  const { status, supabase, user, profile } = useSession();
  const mode = status === "unavailable" ? "local" : "db";
  const canPost = mode === "local" || status === "signed-in";
  const canModerate = profile?.role === "editor" || profile?.role === "admin";

  // Database mode: null until the list is opened for the first time.
  const [dbList, setDbList] = useState<StoryComment[] | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");

  // Local mode: the example comments plus whatever you've written in this browser.
  const allLocal = useLocalStore(localComments);
  const mine = useMemo(() => allLocal[story.id] ?? [], [allLocal, story.id]);
  const localList: StoryComment[] = [
    ...(story.exampleComments ?? []),
    ...mine.map((c) => ({ ...c, authorId: "me", authorName: null })),
  ];

  const list = mode === "local" ? localList : dbList;
  const count = list ? list.filter((c) => !c.hidden).length : story.commentCount;

  const load = useCallback(async () => {
    if (mode !== "db" || !supabase) return;
    setLoadState("loading");
    const result = await fetchComments(supabase, story.id);
    if (result) setDbList(result);
    setLoadState(result ? "idle" : "error");
  }, [mode, supabase, story.id]);

  /** Resolves to true if the comment was posted. */
  const post = useCallback(
    async (body: string): Promise<boolean> => {
      const text = body.trim();
      if (!text || text.length > COMMENT_MAX) return false;
      if (mode === "local") {
        const comment = { id: `local-${Date.now()}`, body: text, createdAt: new Date().toISOString() };
        localComments.write({ ...allLocal, [story.id]: [...mine, comment] });
        return true;
      }
      if (!supabase || !user) return false;
      const { error } = await supabase.from("story_comments").insert({ story_id: story.id, author_id: user.id, body: text });
      if (error) return false;
      await load();
      return true;
    },
    [mode, allLocal, mine, story.id, supabase, user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (mode === "local") {
        localComments.write({ ...allLocal, [story.id]: mine.filter((c) => c.id !== id) });
        return;
      }
      if (!supabase) return;
      const { error } = await supabase.from("story_comments").delete().eq("id", id);
      if (!error) await load();
    },
    [mode, allLocal, mine, story.id, supabase, load],
  );

  /** Editors only (the database refuses anyone else). */
  const setHidden = useCallback(
    async (id: string, hidden: boolean) => {
      if (!supabase) return;
      const { error } = await supabase
        .from("story_comments")
        .update({ status: hidden ? "hidden" : "visible" })
        .eq("id", id);
      if (!error) await load();
    },
    [supabase, load],
  );

  const isMine = (c: StoryComment) => (mode === "local" ? c.authorId === "me" : !!user && c.authorId === user.id);

  return {
    mode,
    sessionLoading: status === "loading",
    canPost,
    canModerate,
    list,
    count,
    loadState,
    load,
    post,
    remove,
    setHidden,
    isMine,
  };
}

export type StoryCommentsState = ReturnType<typeof useStoryComments>;
