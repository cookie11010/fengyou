"use server";

// The public lists (stories, map spots) are cached on the server. The browser
// writes new stories and spots straight to Supabase (RLS checks them), then
// calls this so the writer, and everyone after them, sees the change at once
// instead of after the cache's normal refresh time.
import { updateTag } from "next/cache";

const TAGS = ["stories", "destinations"] as const;
export type ContentTag = (typeof TAGS)[number];

export async function refreshPublicContent(tags: ContentTag[]): Promise<void> {
  // Anyone can call a Server Action, so only accept the known tags.
  for (const tag of new Set(tags)) {
    if ((TAGS as readonly string[]).includes(tag)) updateTag(tag);
  }
}
