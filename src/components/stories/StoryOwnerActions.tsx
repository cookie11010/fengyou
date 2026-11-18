"use client";

// Under a story card: "Delete" for its writer, "Take down" for editors.
// The database decides for real (RLS); this only shows the right button.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshPublicContent } from "@/app/actions";
import { useSession } from "@/components/auth/SessionProvider";
import type { Dictionary } from "@/i18n/dictionaries";
import { removeImage } from "@/lib/upload";

type Props = { storyId: string; authorId: string | null; t: Dictionary["stories"] };

export function StoryOwnerActions({ storyId, authorId, t }: Props) {
  const { supabase, user, profile } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  if (!supabase || !user || gone) return null;
  const isAuthor = !!authorId && authorId === user.id;
  const isEditor = profile?.role === "editor" || profile?.role === "admin";
  if (!isAuthor && !isEditor) return null;

  async function act() {
    if (!supabase) return;
    if (!window.confirm(isAuthor ? t.confirmDelete : t.confirmTakeDown)) return;
    setBusy(true);
    let ok: boolean;
    if (isAuthor) {
      const { data } = await supabase.from("stories").delete().eq("id", storyId).select("image_path").maybeSingle();
      ok = !!data;
      if (data) await removeImage(supabase, (data as { image_path: string | null }).image_path);
    } else {
      const { error } = await supabase.from("stories").update({ status: "archived" }).eq("id", storyId);
      ok = !error;
    }
    if (ok) {
      setGone(true);
      await refreshPublicContent(["stories"]);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void act()}
      className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {isAuthor ? t.delete : t.takeDown}
    </button>
  );
}
