/// <reference types="google.maps" />
/**
 * Google Places autocomplete + map preview for /admin/locations forms.
 *
 * Sits above the existing Astro inputs. When the user picks a place
 * from the suggestions, this component finds the form's <input>
 * elements by name and patches their values:
 *   - name        — Vietnamese place name
 *   - name_en     — Latin name (Google's English-localized name)
 *   - province    — Tỉnh/thành (administrative_area_level_1)
 *   - lat / lng   — coordinates
 *
 * The Astro form keeps its native action + validation. The map
 * preview re-centers as the inputs are edited so the admin can
 * confirm visually.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker, Map, useMap, useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapPin, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import GoogleMapsGate from "./GoogleMapsGate";

interface Props {
  apiKey: string | undefined;
  /** Initial center for the map (existing row's lat/lng or Vietnam default). */
  initialLat?: number | null;
  initialLng?: number | null;
  /** Fallback center / zoom when no row is loaded. From admin settings. */
  defaultLat?: number;
  defaultLng?: number;
  defaultZoom?: number;
}

export default function LocationAutocomplete({
  apiKey,
  initialLat,
  initialLng,
  defaultLat,
  defaultLng,
  defaultZoom,
}: Props) {
  return (
    <GoogleMapsGate apiKey={apiKey}>
      <Inner
        initialLat={initialLat}
        initialLng={initialLng}
        defaultLat={defaultLat}
        defaultLng={defaultLng}
        defaultZoom={defaultZoom}
      />
    </GoogleMapsGate>
  );
}

function Inner({
  initialLat,
  initialLng,
  defaultLat,
  defaultLng,
  defaultZoom,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  defaultLat?: number;
  defaultLng?: number;
  defaultZoom?: number;
}) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    typeof initialLat === "number" && typeof initialLng === "number"
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="place-search" className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          Tìm địa điểm trên Google Maps
        </Label>
        <PlaceAutocompleteInput
          value={searchValue}
          onChangeText={setSearchValue}
          onPick={(p) => {
            setPicked({ lat: p.lat, lng: p.lng });
            applyToForm(p);
            toast.success(`Đã chọn ${p.name ?? "địa điểm"}`);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Gõ tên xã / phường / thành phố. Khi chọn từ gợi ý, các trường ID, tên, tỉnh, lat/lng sẽ tự điền.
        </p>
      </div>

      <MapPreview
        picked={picked}
        defaultLat={defaultLat}
        defaultLng={defaultLng}
        defaultZoom={defaultZoom}
        onMarkerDrag={(latLng) => {
        setPicked(latLng);
        // Sync just lat/lng (the user is fine-tuning, not re-picking).
        const latEl = document.querySelector<HTMLInputElement>('input[name="lat"]');
        const lngEl = document.querySelector<HTMLInputElement>('input[name="lng"]');
        if (latEl) {
          latEl.value = String(latLng.lat);
          latEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (lngEl) {
          lngEl.value = String(latLng.lng);
          lngEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }} />
    </div>
  );
}

type PickedPlace = {
  lat: number;
  lng: number;
  name?: string;
  name_en?: string;
  province?: string;
  /** Slug derived from name_en — used as default ID in create flow. */
  slug?: string;
};

function applyToForm(p: PickedPlace) {
  const setVal = (name: string, value: string) => {
    const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!el || el.readOnly) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  if (p.name) setVal("name", p.name);
  if (p.name_en) setVal("name_en", p.name_en);
  if (p.province) setVal("province", p.province);
  setVal("lat", String(p.lat));
  setVal("lng", String(p.lng));
  // Only seed the ID if it's empty (create flow). Edit-mode IDs are
  // readonly so this is a no-op there.
  const idEl = document.querySelector<HTMLInputElement>('input[name="id"]');
  if (idEl && !idEl.readOnly && !idEl.value && p.slug) {
    idEl.value = p.slug;
    idEl.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/** Renders a styled <input> wired to the Google Places PlacesService
 *  via the Autocomplete service (legacy but stable JS API). */
function PlaceAutocompleteInput({
  value,
  onChangeText,
  onPick,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onPick: (p: PickedPlace) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      // Bias to Vietnam; the admin can still pick anywhere if needed.
      componentRestrictions: { country: "vn" },
      fields: ["name", "geometry", "address_components", "formatted_address"],
    });
    setAutocomplete(ac);
    return () => {
      // No explicit cleanup API — let it garbage-collect with the input.
    };
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) {
        toast.error("Không lấy được tọa độ — chọn lại từ gợi ý.");
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const name = place.name ?? place.formatted_address ?? "";
      const province = pickProvince(place.address_components ?? []);
      // name_en: Google returns a localized name based on language=vi;
      // we don't have a separate en name unless we re-query. Use the
      // formatted_address tail (after first comma) as a rough latin
      // representation so the admin can edit.
      const nameEn = (place.formatted_address ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join(", ") || name;
      const slug = slugify(name);
      onPick({ lat, lng, name, name_en: nameEn, province, slug });
    });
    return () => listener.remove();
  }, [autocomplete, onPick]);

  return (
    <Input
      ref={inputRef}
      id="place-search"
      type="search"
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
      placeholder="vd: Tịnh Khê, Quảng Ngãi"
      className="h-10"
    />
  );
}

function pickProvince(components: google.maps.GeocoderAddressComponent[]): string {
  // Prefer level_1 (province), fall back to level_2.
  const lv1 = components.find((c) => c.types.includes("administrative_area_level_1"));
  if (lv1) return lv1.long_name;
  const lv2 = components.find((c) => c.types.includes("administrative_area_level_2"));
  return lv2?.long_name ?? "";
}

/** Map preview that re-centers as picked changes; supports drag-to-fine-tune. */
function MapPreview({
  picked,
  defaultLat,
  defaultLng,
  defaultZoom,
  onMarkerDrag,
}: {
  picked: { lat: number; lng: number } | null;
  defaultLat?: number;
  defaultLng?: number;
  defaultZoom?: number;
  onMarkerDrag: (p: { lat: number; lng: number }) => void;
}) {
  const center = useMemo(
    () => picked ?? { lat: defaultLat ?? 15.18, lng: defaultLng ?? 108.83 },
    [picked, defaultLat, defaultLng],
  );
  const zoom = picked ? 14 : (defaultZoom ?? 6);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="h-[280px] w-full">
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          {picked && (
            <DraggablePin
              position={picked}
              onDragEnd={onMarkerDrag}
            />
          )}
          <Recenter target={picked} />
        </Map>
      </div>
      {picked && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground tabular-nums flex items-center gap-2">
          <MapPin className="size-3.5" />
          {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          <span className="ml-auto text-muted-foreground/70">
            Kéo điểm pin để chỉnh tọa độ chính xác
          </span>
        </div>
      )}
    </div>
  );
}

function DraggablePin({
  position,
  onDragEnd,
}: {
  position: { lat: number; lng: number };
  onDragEnd: (p: { lat: number; lng: number }) => void;
}) {
  return (
    <AdvancedMarker
      position={position}
      draggable
      onDragEnd={(e) => {
        const lat = e.latLng?.lat();
        const lng = e.latLng?.lng();
        if (typeof lat === "number" && typeof lng === "number") {
          onDragEnd({ lat, lng });
        }
      }}
    />
  );
}

function Recenter({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!map || !target) return;
    const key = `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
    if (last.current === key) return;
    last.current = key;
    map.panTo(target);
    map.setZoom(14);
  }, [map, target]);
  return null;
}
