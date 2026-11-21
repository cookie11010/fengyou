"use client";

import { useEffect, useState } from "react";

/**
 * A key that changes every time this component is hidden, so whatever uses it
 * is rebuilt from scratch when it's shown again.
 *
 * Why: Next.js keeps pages you've navigated away from alive but hidden (React
 * <Activity>), so "Back" is instant. Hiding runs effect clean-ups, which makes
 * Leaflet tear its map down, but the same <div> is kept. Showing the page
 * again then tries to reuse that torn-down map and fails ("Map container is
 * being reused by another instance"), leaving a blank map. A new key gives
 * the map a new <div> and a fresh start instead.
 */
export function useFreshMountKey(): number {
  const [key, setKey] = useState(0);
  // Runs on hide (and on unmount, where it doesn't matter).
  useEffect(() => () => setKey((k) => k + 1), []);
  return key;
}
