"use client";

// Who is signed in, their role, and which places they've saved. One provider
// for the whole site, so the header, Save buttons and pages all agree.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

export type Role = "visitor" | "contributor" | "editor" | "admin";
type Profile = { display_name: string; role: Role };

type SessionState = {
  /** "unavailable" = Supabase isn't configured, so sign-in features are hidden. */
  status: "loading" | "unavailable" | "signed-out" | "signed-in";
  supabase: SupabaseClient | null;
  user: User | null;
  profile: Profile | null;
  savedIds: Set<string>;
  /** Adds a place to the itinerary. Resolves to the new number of stops. */
  saveToItinerary: (destinationId: string) => Promise<number>;
  refreshSaved: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [status, setStatus] = useState<SessionState["status"]>(supabase ? "loading" : "unavailable");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadUserData = useCallback(
    async (u: User | null) => {
      if (!supabase || !u) {
        setProfile(null);
        setSavedIds(new Set());
        return;
      }
      const [profileRes, savedRes] = await Promise.all([
        supabase.from("profiles").select("display_name, role").eq("id", u.id).single(),
        supabase.from("itinerary_items").select("destination_id"),
      ]);
      setProfile((profileRes.data as Profile | null) ?? null);
      setSavedIds(new Set((savedRes.data ?? []).map((r: { destination_id: string }) => r.destination_id)));
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    // Fires once with the stored session, then on every sign-in / sign-out / token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
      if (event !== "TOKEN_REFRESHED") {
        // Run outside the auth callback; Supabase advises against awaiting inside it.
        setTimeout(() => void loadUserData(u), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, loadUserData]);

  const value = useMemo<SessionState>(
    () => ({
      status,
      supabase,
      user,
      profile,
      savedIds,
      saveToItinerary: async (destinationId) => {
        if (!supabase) throw new Error("Supabase is not configured");
        const { data, error } = await supabase.rpc("add_to_itinerary", { p_destination_id: destinationId });
        if (error) throw error;
        setSavedIds((prev) => new Set(prev).add(destinationId));
        return data as number;
      },
      refreshSaved: () => loadUserData(user),
      refreshProfile: () => loadUserData(user),
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [status, supabase, user, profile, savedIds, loadUserData],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Only allow redirects back into this site, e.g. "/en/spots" (never "//evil.com"). */
export function safeNextPath(raw: string | null, fallback: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
