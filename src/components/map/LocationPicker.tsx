"use client";

// A small map for choosing where a new spot is: tap to drop the pin.
// Browser-only (Leaflet needs `window`); AddSpotForm loads it with next/dynamic.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { HSINCHU_CENTER, tileLayer } from "@/lib/map-config";

type Point = { lat: number; lng: number };
type Props = { value: Point | null; onChange: (p: Point) => void };

function ClickToPick({ onChange }: { onChange: (p: Point) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Follows the pin when it's set from outside the map ("Use my location"). */
function FollowPin({ value }: { value: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (value && !map.getBounds().contains([value.lat, value.lng])) map.setView([value.lat, value.lng], 17);
  }, [value, map]);
  return null;
}

export default function LocationPicker({ value, onChange }: Props) {
  const icon = useMemo(
    () =>
      divIcon({
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        html: '<span class="fy-pin fy-pin--selected" style="width:40px;height:40px"></span>',
      }),
    [],
  );

  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : HSINCHU_CENTER}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full cursor-crosshair"
    >
      <TileLayer url={tileLayer.url} attribution={tileLayer.attribution} maxZoom={tileLayer.maxZoom} />
      <ClickToPick onChange={onChange} />
      <FollowPin value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onChange({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
