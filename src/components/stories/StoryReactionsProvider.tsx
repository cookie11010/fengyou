"use client";

// Which stories the visitor has liked and saved, shared by every card on the page.
//
// Three modes:
//   "db"         signed in: reactions live in Supabase (story_reactions)
//   "local"      Supabase isn't connected (example stories): kept in this
//                browser's localStorage, so the buttons can be tried out
//   "signed-out" Supabase is connected but nobody is signed in: buttons lead to sign-in
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import type { Locale } from "@/i18n/config";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

type Kind = "like" | "save";
type Mode = "loading" | "db" | "local" | "signed-out";

type ReactionsState = {
  mode: Mode;
  liked: Set<string>;
  saved: Set<string>;
  /** How much the like count shown should change from the (cached) server number. */
  likeDelta: (storyId: string) => number;
  toggle: (kind: Kind, storyId: string) => Promise<void>;
};

const Ctx = createContext<ReactionsState | null>(null);

/* ---- localStorage store (example mode) ------------------------------------ */
const localReactions = createLocalStore("fengyou-story-reactions", (v) => {
  const o = (v ?? {}) as { like?: unknown; save?: unknown };
  return {
    like: Array.isArray(o.like) ? (o.like as string[]) : [],
    save: Array.isArray(o.save) ? (o.save as string[]) : [],
  };
});

export function StoryReactionsProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { status, supabase, user } = useSession();
  const router = useRouter();

  const mode: Mode =
    status === "unavailable" ? "local" : status === "signed-in" ? "db" : status === "signed-out" ? "signed-out" : "loading";

  // Local mode
  const local = useLocalStore(localReactions);

  // Database mode: what was stored when the page loaded, plus changes since.
  const [dbInitial, setDbInitial] = useState<{ like: Set<string>; save: Set<string> } | null>(null);
  const [dbNow, setDbNow] = useState<{ like: Set<string>; save: Set<string> }>({ like: new Set(), save: new Set() });

  useEffect(() => {
    if (mode !== "db" || !supabase || !user) return;
    let active = true;
    void supabase
      .from("story_reactions")
      .select("story_id, kind")
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as { story_id: string; kind: Kind }[];
        const sets = {
          like: new Set(rows.filter((r) => r.kind === "like").map((r) => r.story_id)),
          save: new Set(rows.filter((r) => r.kind === "save").map((r) => r.story_id)),
        };
        setDbInitial(sets);
        setDbNow({ like: new Set(sets.like), save: new Set(sets.save) });
      });
    return () => {
      active = false;
    };
  }, [mode, supabase, user]);

  const liked = mode === "local" ? new Set(local.like) : mode === "db" ? dbNow.like : new Set<string>();
  const saved = mode === "local" ? new Set(local.save) : mode === "db" ? dbNow.save : new Set<string>();

  const likeDelta = useCallback(
    (id: string) => {
      // Example stories always start at 0, so a local like simply adds 1.
      if (mode === "local") return local.like.includes(id) ? 1 : 0;
      // The server count already includes likes that existed when it was cached.
      if (mode === "db" && dbInitial) return (dbNow.like.has(id) ? 1 : 0) - (dbInitial.like.has(id) ? 1 : 0);
      return 0;
    },
    [mode, local, dbInitial, dbNow],
  );

  const toggle = useCallback(
    async (kind: Kind, id: string) => {
      if (mode === "signed-out") {
        router.push(`/${locale}/sign-in?next=/${locale}/stories`);
        return;
      }
      if (mode === "local") {
        const list = local[kind];
        localReactions.write({ ...local, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
        return;
      }
      if (mode !== "db" || !supabase || !user) return;

      const isOn = dbNow[kind].has(id);
      // Update the screen straight away, then undo if the database says no.
      const flip = (on: boolean) =>
        setDbNow((prev) => {
          const next = new Set(prev[kind]);
          if (on) next.add(id);
          else next.delete(id);
          return { ...prev, [kind]: next };
        });
      flip(!isOn);
      const { error } = isOn
        ? await supabase.from("story_reactions").delete().match({ user_id: user.id, story_id: id, kind })
        : await supabase.from("story_reactions").insert({ user_id: user.id, story_id: id, kind });
      if (error) flip(isOn);
    },
    [mode, local, dbNow, supabase, user, router, locale],
  );

  const value = { mode, liked, saved, likeDelta, toggle };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoryReactions(): ReactionsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStoryReactions must be used inside <StoryReactionsProvider>");
  return ctx;
}
