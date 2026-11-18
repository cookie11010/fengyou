// Map tiles. OpenStreetMap's standard tiles need no API key, only visible
// attribution. Their usage policy is meant for light traffic, so a launched
// site should switch to a tile provider (e.g. MapTiler, Stadia, Carto) via
// the env variables below.
//
// Note: tile-provider keys are *browser* keys. They always end up in the page,
// so treat them as public and lock them to your domain in the provider's
// dashboard. Never put a secret server key here.
export const tileLayer = {
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

/** Hsinchu old town, used before markers load or when there are none. */
export const HSINCHU_CENTER: [number, number] = [24.8039, 120.9719];
