/**
 * Tiny client island that fires a sonner toast when the parent Astro
 * page server-rendered a one-shot success/error message. Replaces the
 * old "banner box at top of page" pattern with modern slide-in toasts.
 *
 * Usage:
 *   <ToastBanner client:load kind="ok" text="Đã lưu" />
 *
 * Toast fires once per mount, then the component renders nothing.
 */
import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";

interface Props {
  kind: "ok" | "err" | "warn";
  text: string;
  /** Optional title displayed above the description. */
  title?: string;
}

export default function ToastBanner({ kind, text, title }: Props) {
  useEffect(() => {
    if (!text) return;
    const opts = title ? { description: text } : undefined;
    const msg = title ?? text;
    if (kind === "ok") toast.success(msg, opts);
    else if (kind === "warn") toast.warning(msg, opts);
    else toast.error(msg, opts);
  }, [kind, text, title]);

  return null;
}
