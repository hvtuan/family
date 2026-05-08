/**
 * Modal that walks the user through linking a chat channel (Telegram, Zalo)
 * to their account. Opens via "Liên kết" button in NotificationChannels.
 *
 * Flow:
 *   1. Modal opens → POST /api/notifications/channels/[id]/begin to get
 *      a deeplink (Telegram) or URL (Zalo)
 *   2. Show the link as a clickable button + a QR code so user can scan
 *      with phone
 *   3. Poll /api/notifications/channels/[id]/status every 3s to detect
 *      when the user has completed the chat-side action
 *   4. On linked=true → toast success + close modal + parent re-fetches
 *      preferences
 */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast, Toaster } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  channel: "telegram" | "zalo" | "messenger" | "whatsapp" | "sms";
  channelLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

interface BeginResponse {
  ok: boolean;
  kind?: "url" | "code" | "deeplink";
  value?: string;
  error?: string;
}

export default function ChannelLinkDialog({
  channel, channelLabel, open, onOpenChange, onLinked,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<BeginResponse | null>(null);
  const [polling, setPolling] = useState(false);

  // Step 1: when dialog opens, request a fresh link
  useEffect(() => {
    if (!open) {
      setLink(null);
      setPolling(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications/channels/${channel}/begin`, { method: "POST" });
        const json = (await res.json()) as BeginResponse;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? "Không tạo được liên kết");
          onOpenChange(false);
          return;
        }
        setLink(json);
        setPolling(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, channel]);

  // Step 2: poll status every 3s while polling=true
  useEffect(() => {
    if (!polling) return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/notifications/channels/${channel}/status`);
        if (!res.ok) return;
        const json = (await res.json()) as { linked: boolean };
        if (json.linked) {
          setPolling(false);
          toast.success(`Đã liên kết ${channelLabel}`);
          onLinked();
          onOpenChange(false);
        }
      } catch {
        // network blip — keep polling
      }
    };
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [polling, channel, channelLabel, onLinked, onOpenChange]);

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Liên kết {channelLabel}</DialogTitle>
          </DialogHeader>

          {loading && <p className="text-sm text-muted-foreground">Đang tạo liên kết...</p>}

          {link && link.value && (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Bấm nút bên dưới hoặc quét mã QR bằng điện thoại để mở {channelLabel} và liên kết tài khoản.
              </p>

              <div className="flex justify-center bg-white p-4 rounded">
                <QRCodeSVG value={link.value} size={180} />
              </div>

              <Button asChild>
                <a href={link.value} target="_blank" rel="noopener noreferrer">
                  Mở {channelLabel} ↗
                </a>
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Đang chờ bạn hoàn tất bước trên {channelLabel}... (tự động đóng khi xong)
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
