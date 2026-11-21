"use client";

// Who is signed in, their role, and their trips. One provider for the whole
// site, so the header, "Add to trip" buttons and pages all agree.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

export type Role = "visitor" | "contributor" | "editor" | "admin";
type Profile = { display_name: string; role: Role };

/** One of the user's trips, with the places in it (in visiting order). */
export type TripSummary = {
  id: string;
  title: string;
  startDate: string | null; // "2026-12-19"
  endDate: string | null;
  placeIds: string[];
};

/** Where "Add to trip" should put the places: an existing trip, or a new one. */
export type TripTarget = { tripId: string } | { newTitle: string; startDate?: string | null; endDate?: string | null };

type TripRow = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  items: { destination_id: string; position: number }[];
};

type SessionState = {
  /** "unavailable" = Supabase isn't configured, so sign-in features are hidden. */
  status: "loading" | "unavailable" | "signed-out" | "signed-in";
  supabase: SupabaseClient | null;
  user: User | null;
  profile: Profile | null;
  /** The user's trips, most recently changed first. */
  trips: TripSummary[];
  /** False until the signed-in user's trips have been read once. */
  tripsLoaded: boolean;
  /** Every place that is in at least one trip. */
  savedIds: Set<string>;
  /** Adds places (in order) to a trip, or to a new trip. Resolves to the trip's id. */
  addToTrip: (target: TripTarget, destinationIds: string[]) => Promise<string>;
  /** Adds one place to the most recent trip (making one if there are none). */
  saveToItinerary: (destinationId: string) => Promise<void>;
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
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const savedIds = useMemo(() => new Set(trips.flatMap((t) => t.placeIds)), [trips]);

  const loadTrips = useCallback(async () => {
    if (!supabase) return;
    // RLS returns only this user's trips and stops.
    const { data } = await supabase
      .from("itineraries")
      .select("id, title, start_date, end_date, items:itinerary_items (destination_id, position)")
      .order("updated_at", { ascending: false })
      .overrideTypes<TripRow[], { merge: false }>();
    setTrips(
      (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        startDate: r.start_date,
        endDate: r.end_date,
        placeIds: [...r.items].sort((a, b) => a.position - b.position).map((i) => i.destination_id),
      })),
    );
    setTripsLoaded(true);
  }, [supabase]);

  const loadUserData = useCallback(
    async (u: User | null) => {
      if (!supabase || !u) {
        setProfile(null);
        setTrips([]);
        setTripsLoaded(false);
        return;
      }
      const [profileRes] = await Promise.all([
        supabase.from("profiles").select("display_name, role").eq("id", u.id).single(),
        loadTrips(),
      ]);
      setProfile((profileRes.data as Profile | null) ?? null);
    },
    [supabase, loadTrips],
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

  const addToTrip = useCallback(
    async (target: TripTarget, destinationIds: string[]): Promise<string> => {
      if (!supabase) throw new Error("Supabase is not configured");
      let tripId: string;
      if ("tripId" in target) {
        const { error } = await supabase.rpc("add_places_to_trip", {
          p_itinerary_id: target.tripId,
          p_destination_ids: destinationIds,
        });
        if (error) throw error;
        tripId = target.tripId;
      } else {
        // An empty title becomes "My Hsinchu trip" in the database.
        const { data, error } = await supabase.rpc("create_trip", {
          p_title: target.newTitle,
          p_start_date: target.startDate || null,
          p_end_date: target.endDate || null,
          p_destination_ids: destinationIds,
        });
        if (error) throw error;
        tripId = data as string;
      }
      await loadTrips();
      return tripId;
    },
    [supabase, loadTrips],
  );

  const value = useMemo<SessionState>(
    () => ({
      status,
      supabase,
      user,
      profile,
      trips,
      tripsLoaded,
      savedIds,
      addToTrip,
      saveToItinerary: async (destinationId) => {
        await addToTrip(trips[0] ? { tripId: trips[0].id } : { newTitle: "" }, [destinationId]);
      },
      refreshSaved: loadTrips,
      refreshProfile: () => loadUserData(user),
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [status, supabase, user, profile, trips, tripsLoaded, savedIds, addToTrip, loadTrips, loadUserData],
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
