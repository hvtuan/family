/// <reference types="google.maps" />
/**
 * Mini map shown inside MemberModal when at least one of the member's
 * recorded places (birthPlace / deathPlace / gravesite) matches a row
 * in family.locations. Shows up to 3 colored pins with InfoWindow
 * captions explaining what each pin means for this person.
 *
 * Renders nothing when:
 *   - no API key configured (silent fallback — the dl above already
 *     shows the place names as plain text)
 *   - none of the three places resolve to a known location
 */
import { useEffect, useMemo, useState } from "react";
import {
  AdvancedMarker, APIProvider, InfoWindow, Map as GMap, useMap,
} from "@vis.gl/react-google-maps";

import type { LocationLookup } from "./MemberModal";

interface Props {
  apiKey?: string;
  locationLookup: LocationLookup;
  birthPlace?: string;
  deathPlace?: string;
  gravesite?: string;
}

type PinKind = "born" | "died" | "buried";

type PlacePin = {
  kind: PinKind;
  label: string;
  emoji: string;
  color: string;
  name: string;
  province?: string;
  lat: number;
  lng: number;
  /** Original place text from the member record. */
  raw: string;
};

const KIND_META: Record<PinKind, { label: string; emoji: string; color: string }> = {
  born: { label: "Quê quán", emoji: "🏡", color: "#2f4a3a" }, // jade
  died: { label: "Nơi mất", emoji: "🌿", color: "#8b2a1f" }, // vermilion
  buried: { label: "Phần mộ", emoji: "🌸", color: "#a8853f" }, // gold
};

function resolvePlace(
  raw: string | undefined,
  lookup: LocationLookup,
): { name: string; province?: string; lat: number; lng: number } | null {
  if (!raw) return null;
  const needle = raw.toLowerCase().trim();
  if (!needle) return null;
  // Exact key match wins; otherwise scan for substring containment in
  // either direction.
  const exact = lookup[needle];
  if (exact) return { name: exact.name, province: exact.province, lat: exact.lat, lng: exact.lng };
  for (const key of Object.keys(lookup)) {
    if (needle.includes(key) || key.includes(needle)) {
      const e = lookup[key];
      return { name: e.name, province: e.province, lat: e.lat, lng: e.lng };
    }
  }
  return null;
}

export default function MemberPlacesMap({
  apiKey,
  locationLookup,
  birthPlace,
  deathPlace,
  gravesite,
}: Props) {
  const pins: PlacePin[] = useMemo(() => {
    const out: PlacePin[] = [];
    const candidates: { kind: PinKind; raw?: string }[] = [
      { kind: "born", raw: birthPlace },
      { kind: "died", raw: deathPlace },
      { kind: "buried", raw: gravesite },
    ];
    // Dedupe by lat/lng — if two of the three places resolve to the
    // same coords, render a single pin with combined labels.
    const seen = new Map<string, PlacePin>();
    for (const { kind, raw } of candidates) {
      const r = resolvePlace(raw, locationLookup);
      if (!r) continue;
      const key = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
      const meta = KIND_META[kind];
      const existing = seen.get(key);
      if (existing) {
        // Combine labels — first kind keeps its color, label gets joined.
        existing.label = `${existing.label} · ${meta.label}`;
        existing.emoji = `${existing.emoji}${meta.emoji}`;
        continue;
      }
      const pin: PlacePin = {
        kind,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        name: r.name,
        province: r.province,
        lat: r.lat,
        lng: r.lng,
        raw: raw ?? "",
      };
      seen.set(key, pin);
      out.push(pin);
    }
    return out;
  }, [birthPlace, deathPlace, gravesite, locationLookup]);

  if (!apiKey || pins.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-cream">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-2/50 px-3 py-2">
        <h3 className="font-display text-sm font-semibold text-ink">
          Bản đồ nơi gắn bó
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-ink-3">
          {pins.map((p) => (
            <span key={`${p.lat},${p.lng}`} className="inline-flex items-center gap-1">
              <span style={{ color: p.color }}>●</span>
              {p.label}
            </span>
          ))}
        </div>
      </header>
      <div className="h-[260px] w-full">
        <APIProvider apiKey={apiKey} libraries={["marker"]} language="vi" region="VN">
          <GMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: pins[0].lat, lng: pins[0].lng }}
            defaultZoom={pins.length === 1 ? 12 : 6}
            gestureHandling="cooperative"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl
          >
            <PinList pins={pins} />
            <FitBounds pins={pins} />
          </GMap>
        </APIProvider>
      </div>
    </div>
  );
}

function PinList({ pins }: { pins: PlacePin[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <>
      {pins.map((p) => {
        const key = `${p.lat},${p.lng}`;
        return (
          <AdvancedMarker
            key={key}
            position={{ lat: p.lat, lng: p.lng }}
            onClick={() => setActive(key)}
          >
            <div style={{ color: p.color }}>
              <svg width="32" height="40" viewBox="0 0 24 30" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.4 18.6 0 12 0z" />
                <circle cx="12" cy="12" r="5" fill="white" />
              </svg>
            </div>
          </AdvancedMarker>
        );
      })}
      {active && (() => {
        const p = pins.find((x) => `${x.lat},${x.lng}` === active);
        if (!p) return null;
        return (
          <InfoWindow
            position={{ lat: p.lat, lng: p.lng }}
            onCloseClick={() => setActive(null)}
            pixelOffset={[0, -36]}
          >
            <div style={{ minWidth: 180, maxWidth: 240 }}>
              <p style={{
                margin: 0,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: p.color,
                fontWeight: 600,
              }}>
                {p.emoji} {p.label}
              </p>
              <h4 style={{
                margin: "4px 0 0",
                fontSize: 14,
                fontWeight: 600,
                color: "#1a120a",
              }}>
                {p.name}
              </h4>
              {p.province && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#5c4a33" }}>
                  {p.province}
                </p>
              )}
              <a
                href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 11,
                  color: p.color,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Mở Google Maps ↗
              </a>
            </div>
          </InfoWindow>
        );
      })()}
    </>
  );
}

function FitBounds({ pins }: { pins: PlacePin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of pins) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 48);
  }, [map, pins]);
  return null;
}
