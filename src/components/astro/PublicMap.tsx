/// <reference types="google.maps" />
/**
 * Public-facing family map. Same Google Maps stack as the admin map
 * but read-only and styled to match the public Base layout (paper
 * tones, jade/vermilion accents).
 *
 * Falls back to the existing VietnamSVG decorative outline when no
 * PUBLIC_GOOGLE_MAPS_API_KEY is configured (component returns null in
 * that branch; the parent Astro page renders the SVG).
 */
import { useEffect, useState } from "react";
import {
  AdvancedMarker, APIProvider, InfoWindow, Map as GMap, useMap,
} from "@vis.gl/react-google-maps";

export type PublicMarker = {
  id: string;
  name: string;
  nameEn?: string;
  isHometown: boolean;
  lat: number;
  lng: number;
  members: number;
  memberNames?: string[];
};

interface Props {
  apiKey: string;
  markers: PublicMarker[];
  /** Height in CSS units (e.g. "60vh", 480). Defaults to 480px. */
  height?: number | string;
}

export default function PublicMap({ apiKey, markers, height = 480 }: Props) {
  if (markers.length === 0) return null;
  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-cream shadow-paper-1"
      style={{ height }}
    >
      <APIProvider apiKey={apiKey} libraries={["marker"]} language="vi" region="VN">
        <GMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 16.05, lng: 108.21 }}
          defaultZoom={6}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl
        >
          <Pins markers={markers} />
          <FitToMarkers markers={markers} />
        </GMap>
      </APIProvider>
    </div>
  );
}

function Pins({ markers }: { markers: PublicMarker[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <>
      {markers.map((m) => (
        <AdvancedMarker
          key={m.id}
          position={{ lat: m.lat, lng: m.lng }}
          onClick={() => setActive(m.id)}
        >
          <div
            style={{ color: m.isHometown ? "var(--color-vermilion)" : "var(--color-jade)" }}
          >
            <svg width="34" height="42" viewBox="0 0 24 30" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.4 18.6 0 12 0z" />
              <circle cx="12" cy="12" r="5.5" fill="white" />
              {m.isHometown && (
                <text
                  x="12"
                  y="15"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="currentColor"
                >
                  ★
                </text>
              )}
            </svg>
          </div>
        </AdvancedMarker>
      ))}
      {active && (() => {
        const m = markers.find((x) => x.id === active);
        if (!m) return null;
        return (
          <InfoWindow
            position={{ lat: m.lat, lng: m.lng }}
            onCloseClick={() => setActive(null)}
            pixelOffset={[0, -38]}
          >
            <div style={{ minWidth: 200, maxWidth: 260 }}>
              <h3 style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "#1a120a",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {m.isHometown && (
                  <span style={{ color: "#c9a35a", fontSize: 14 }}>★</span>
                )}
                {m.name}
              </h3>
              {m.nameEn && (
                <p style={{ margin: "2px 0 0", fontSize: 11, fontStyle: "italic", color: "#5c4a33" }}>
                  {m.nameEn}
                </p>
              )}
              {m.isHometown && (
                <p style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  color: "#8b2a1f",
                  fontWeight: 600,
                }}>
                  Quê hương khởi tổ
                </p>
              )}
              {m.members > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#3a2a1a" }}>
                  {m.members} thành viên gắn với nơi này
                </p>
              )}
              {m.memberNames && m.memberNames.length > 0 && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5c4a33" }}>
                  {m.memberNames.slice(0, 5).join(", ")}
                  {m.memberNames.length > 5 && ` …`}
                </p>
              )}
            </div>
          </InfoWindow>
        );
      })()}
    </>
  );
}

function FitToMarkers({ markers }: { markers: PublicMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(11);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const m of markers) {
      bounds.extend({ lat: m.lat, lng: m.lng });
    }
    map.fitBounds(bounds, 64);
  }, [map, markers]);
  return null;
}
