/**
 * Render a date string with locale formatting that depends on the
 * client clock / timezone — without breaking SSR hydration.
 *
 * On the server we render a stable, deterministic placeholder
 * (timezone-free YYYY-MM-DD slice from the ISO string). On the
 * client, after mount, we replace it with the user's locale-aware
 * version. This avoids the hydration mismatch (#418) you'd otherwise
 * get when the server is in UTC and the visitor's browser is in
 * Asia/Ho_Chi_Minh.
 */
import { useEffect, useState } from "react";

interface Props {
  iso: string;
  /** "datetime" → date + hh:mm, "date" → date only. */
  variant?: "datetime" | "date";
}

function isoSlice(iso: string, variant: "datetime" | "date"): string {
  // YYYY-MM-DDTHH:MM:SS… → keep through minutes (or just the date).
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return iso;
  const dmy = `${m[3]}/${m[2]}/${m[1]}`;
  if (variant === "date" || !m[4]) return dmy;
  return `${dmy} ${m[4]}:${m[5]}`;
}

export default function ClientDate({ iso, variant = "datetime" }: Props) {
  const [client, setClient] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    if (variant === "date") {
      setClient(d.toLocaleDateString("vi-VN"));
    } else {
      setClient(
        d.toLocaleString("vi-VN", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        }),
      );
    }
  }, [iso, variant]);
  return <>{client ?? isoSlice(iso, variant)}</>;
}
