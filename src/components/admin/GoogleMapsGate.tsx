/**
 * Wraps any Google Maps-driven UI with the official APIProvider plus a
 * graceful fallback when PUBLIC_GOOGLE_MAPS_API_KEY isn't configured.
 *
 *   <GoogleMapsGate apiKey={key}>
 *     <MapTab ... />
 *   </GoogleMapsGate>
 *
 * apiKey is read from import.meta.env on the parent Astro page (so it
 * stays a public, browser-safe build-time constant).
 */
import { APIProvider } from "@vis.gl/react-google-maps";
import { Info } from "lucide-react";

interface Props {
  apiKey: string | undefined;
  children: React.ReactNode;
  /** Optional fallback rendered when no key is configured. */
  fallback?: React.ReactNode;
}

export default function GoogleMapsGate({ apiKey, children, fallback }: Props) {
  if (!apiKey) {
    return (
      fallback ?? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Info className="size-4 text-primary" />
            <span className="font-medium">Bản đồ chưa được cấu hình</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Để hiện bản đồ và gợi ý địa điểm, hãy đặt biến môi trường{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            trong{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              .env.local
            </code>
            . Xem hướng dẫn ở{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              .env.example
            </code>
            .
          </p>
        </div>
      )
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places", "marker"]} language="vi" region="VN">
      {children}
    </APIProvider>
  );
}
