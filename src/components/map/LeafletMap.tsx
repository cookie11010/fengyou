"use client";

// Leaflet touches `window` as soon as it's imported, so this file must only
// load in the browser. DestinationExplorer imports it with next/dynamic and
// { ssr: false }.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { HSINCHU_CENTER, tileLayer } from "@/lib/map-config";
import type { MapDestination } from "@/types/content";

type LeafletMapProps = {
  destinations: MapDestination[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  markerHint: string; // e.g. "Show details", appended to each marker's name
};

// A CSS pin rather than Leaflet's default PNG marker, which breaks under
// bundlers and wouldn't match the site. Two versions: normal and selected.
function pinIcon(selected: boolean) {
  const size = selected ? 44 : 36;
  return divIcon({
    className: "", // drop Leaflet's default white box
    iconSize: [size, size],
    iconAnchor: [size / 2, size], // the pin's tip sits on the coordinate
    html: `<span class="fy-pin ${selected ? "fy-pin--selected" : ""}" style="width:${size}px;height:${size}px"></span>`,
  });
}

/**
 * Pans to the selected place. The info panel covers the bottom of the map,
 * so we aim a bit below the place, which puts the pin in the upper part of the view.
 * Instant if the visitor prefers reduced motion.
 */
function FlyToSelected({ destination }: { destination?: MapDestination }) {
  const map = useMap();
  useEffect(() => {
    if (!destination) return;
    const zoom = Math.max(map.getZoom(), 16);
    const pinPoint = map.project([destination.lat, destination.lng], zoom);
    const center = map.unproject(pinPoint.add([0, map.getSize().y * 0.2]), zoom);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.setView(center, zoom);
    else map.flyTo(center, zoom, { duration: 0.6 });
  }, [destination, map]);
  return null;
}

export default function LeafletMap({ destinations, selectedId, onSelect, markerHint }: LeafletMapProps) {
  const icons = useMemo(() => ({ normal: pinIcon(false), selected: pinIcon(true) }), []);

  // Start zoomed to fit every marker, with some breathing room.
  const bounds = useMemo(
    () => (destinations.length > 1 ? latLngBounds(destinations.map((d) => [d.lat, d.lng])).pad(0.25) : undefined),
    [destinations],
  );

  return (
    <MapContainer
      bounds={bounds}
      center={bounds ? undefined : destinations[0] ? [destinations[0].lat, destinations[0].lng] : HSINCHU_CENTER}
      zoom={bounds ? undefined : 15}
      scrollWheelZoom={false} // don't hijack page scrolling; use +/- or pinch
      zoomSnap={0.5} // half-step zoom fits the markers more snugly on narrow screens
      className="h-full w-full"
    >
      <TileLayer url={tileLayer.url} attribution={tileLayer.attribution} maxZoom={tileLayer.maxZoom} />

      {destinations.map((d) => (
        <Marker
          key={d.id}
          position={[d.lat, d.lng]}
          icon={d.id === selectedId ? icons.selected : icons.normal}
          zIndexOffset={d.id === selectedId ? 1000 : 0}
          // Markers are keyboard-focusable buttons in Leaflet; `title`
          // gives them a name for screen readers and a tooltip on hover.
          title={`${d.name} – ${markerHint}`}
          eventHandlers={{
            click: () => onSelect(d.id),
            // Leaflet makes markers focusable but doesn't activate them from
            // the keyboard, so do what a real button does on Enter/Space.
            keydown: (e) => {
              const key = (e.originalEvent as KeyboardEvent).key;
              if (key === "Enter" || key === " ") {
                e.originalEvent.preventDefault();
                onSelect(d.id);
              }
            },
          }}
        />
      ))}

      <FlyToSelected destination={destinations.find((d) => d.id === selectedId)} />
    </MapContainer>
  );
}
