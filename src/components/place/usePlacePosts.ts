"use client";

// Posts on one place's page: the discussion ("comment") and food tips
// ("food"). Reading is open to everyone; posting needs an account; editors
// can hide posts. The database rules (place_posts in the
// 20261121120000 migration) enforce all of this. This hook only calls them.
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";

export type PlacePostKind = "comment" | "food";

export type PlacePost = {
  id: string;
  kind: PlacePostKind;
  dish: string | null;
  body: string | null;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  hidden: boolean;
};

type Row = {
  id: string;
  kind: PlacePostKind;
  dish: string | null;
  body: string | null;
  created_at: string;
  author_id: string;
  status: "visible" | "hidden";
};

/** Limits, the same as the database checks. */
export const LIMITS = { comment: 1000, dish: 80, foodNote: 300 } as const;

export function usePlacePosts(destinationId: string) {
  const { status, supabase, user, profile } = useSession();
  const [posts, setPosts] = useState<PlacePost[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const canModerate = profile?.role === "editor" || profile?.role === "admin";

  const fetchPosts = useCallback(async (): Promise<PlacePost[] | null> => {
    if (!supabase) return null;
    // RLS decides what comes back: visible posts for everyone, plus hidden ones for editors.
    const { data, error } = await supabase
      .from("place_posts")
      .select("id, kind, dish, body, created_at, author_id, status")
      .eq("destination_id", destinationId)
      .order("created_at", { ascending: true })
      .limit(300)
      .overrideTypes<Row[], { merge: false }>();
    if (error) return null;

    // Names come from the public author_profiles view (name only, nothing private).
    const ids = [...new Set((data ?? []).map((p) => p.author_id))];
    const { data: authors } = ids.length
      ? await supabase.from("author_profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string }[] };
    const nameById = new Map((authors ?? []).map((a) => [a.id as string, a.display_name as string]));

    return (data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      dish: p.dish,
      body: p.body,
      createdAt: p.created_at,
      authorId: p.author_id,
      authorName: nameById.get(p.author_id) ?? null,
      hidden: p.status === "hidden",
    }));
  }, [supabase, destinationId]);

  const reload = useCallback(async () => {
    const result = await fetchPosts();
    setLoadError(result === null);
    if (result) setPosts(result);
  }, [fetchPosts]);

  // Load once the session is known (editors also see hidden posts).
  useEffect(() => {
    if (status === "loading" || status === "unavailable") return;
    let active = true;
    void fetchPosts().then((result) => {
      if (!active) return;
      setLoadError(result === null);
      if (result) setPosts(result);
    });
    return () => {
      active = false;
    };
  }, [status, fetchPosts, profile?.role]);

  /** Resolves to null on success, or an error message. */
  const post = useCallback(
    async (kind: PlacePostKind, fields: { dish?: string; body?: string }): Promise<string | null> => {
      if (!supabase || !user) return "Not signed in";
      const dish = fields.dish?.trim() || null;
      const body = fields.body?.trim() || null;
      const { error } = await supabase
        .from("place_posts")
        .insert({ destination_id: destinationId, author_id: user.id, kind, dish: kind === "food" ? dish : null, body });
      if (error) return error.message;
      await reload();
      return null;
    },
    [supabase, user, destinationId, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from("place_posts").delete().eq("id", id);
      if (!error) await reload();
    },
    [supabase, reload],
  );

  /** Editors only (the database refuses anyone else). */
  const setHidden = useCallback(
    async (id: string, hidden: boolean) => {
      if (!supabase) return;
      const { error } = await supabase.from("place_posts").update({ status: hidden ? "hidden" : "visible" }).eq("id", id);
      if (!error) await reload();
    },
    [supabase, reload],
  );

  return {
    status,
    posts,
    loadError,
    canPost: status === "signed-in",
    canModerate,
    isMine: (p: PlacePost) => !!user && p.authorId === user.id,
    post,
    remove,
    setHidden,
  };
}

export type PlacePostsState = ReturnType<typeof usePlacePosts>;
