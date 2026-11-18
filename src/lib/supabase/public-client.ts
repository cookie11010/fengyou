// Supabase client for PUBLIC data, using the publishable (anon) key.
//
// This key is meant to be public: Row Level Security in supabase/migrations
// limits it to published content. The secret (service role) key must never
// be used here. It bypasses RLS and belongs only in server-only code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns null when Supabase isn't configured (e.g. no .env.local yet). */
export function getPublicSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (key?.startsWith("sb_secret_")) {
    throw new Error("A secret Supabase key was put in a NEXT_PUBLIC_ variable. Use the publishable key.");
  }

  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

/** Public URL of a file in the 'media' Storage bucket (external URLs pass through). */
export function mediaUrl(storagePath: string): string {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/media/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}
