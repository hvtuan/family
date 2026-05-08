import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function WebPushPermission({ vapidPublicKey }: Props) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (ok && Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration().then((r) => {
        r?.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)));
      });
    }
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Bạn chưa cho phép thông báo trình duyệt.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });
      const res = await fetch("/api/notifications/web-push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        toast.error("Lỗi đăng ký thiết bị.");
        return;
      }
      setSubscribed(true);
      toast.success("Đã bật thông báo trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/web-push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Đã tắt thông báo trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-xs text-amber-600 m-0">Trình duyệt không hỗ trợ web push.</p>;
  }
  if (!vapidPublicKey) {
    return <p className="text-xs text-gray-500 m-0">Web push chưa cấu hình. Quản trị cần thêm VAPID key.</p>;
  }
  return subscribed ? (
    <Button type="button" variant="outline" size="sm" onClick={unsubscribe} disabled={busy}>
      Tắt thông báo trình duyệt
    </Button>
  ) : (
    <Button type="button" size="sm" onClick={subscribe} disabled={busy}>
      Bật thông báo trình duyệt
    </Button>
  );
}
