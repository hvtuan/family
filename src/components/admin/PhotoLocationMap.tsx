/// <reference types="google.maps" />
/**
 * Mini map preview shown on /admin/media/[id] when the photo's
 * location field matches a record in family.locations. Lets the
 * admin see where the shot was taken without leaving the page.
 */
import { AdvancedMarker, APIProvider, Map as GMap } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  apiKey: string;
  location: {
    name: string;
    lat: number;
    lng: number;
    province: string | null;
  };
  photoCaption: string;
}

export default function PhotoLocationMap({ apiKey, location, photoCaption }: Props) {
  if (!apiKey) {
    // Quiet fallback — just a small text panel pointing at the location.
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
        <h3 className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MapPin className="size-4 text-jade" />
          {location.name}
        </h3>
        {location.province && (
          <p className="text-xs text-muted-foreground">{location.province}</p>
        )}
        <p className="mt-1.5 font-mono text-xs text-muted-foreground tabular-nums">
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Đặt <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          để xem bản đồ.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-theme-xs">
      <header className="flex items-start justify-between gap-3 border-b border-border bg-jade/5 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-jade" />
            {location.name}
          </h3>
          {location.province && (
            <p className="mt-0.5 text-xs text-muted-foreground">{location.province}</p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Mở Google Maps ↗
          </a>
        </Button>
      </header>
      <div className="h-[220px] w-full">
        <APIProvider apiKey={apiKey} libraries={["marker"]} language="vi" region="VN">
          <GMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: location.lat, lng: location.lng }}
            defaultZoom={13}
            gestureHandling="cooperative"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl
          >
            <AdvancedMarker
              position={{ lat: location.lat, lng: location.lng }}
              title={photoCaption}
            >
              <div className="text-jade">
                <svg width="32" height="40" viewBox="0 0 24 30" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.4 18.6 0 12 0z" />
                  <circle cx="12" cy="12" r="5" fill="white" />
                </svg>
              </div>
            </AdvancedMarker>
          </GMap>
        </APIProvider>
      </div>
    </div>
  );
}
