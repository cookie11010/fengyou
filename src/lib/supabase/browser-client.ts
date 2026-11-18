// Supabase client for the BROWSER, with a signed-in session.
//
// It uses the same publishable key as the public client. Signing in doesn't
// unlock anything by itself: Row Level Security reads the user's id from the
// session token and decides row by row. The secret key is never used here.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns null when Supabase isn't configured (sign-in features then show as unavailable). */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: "fengyou-auth" },
        })
      : null;
  return client;
}
