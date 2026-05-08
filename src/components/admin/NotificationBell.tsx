import { useEffect, useState } from "react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Item {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  seen: boolean;
}

const ICON_FOR_EVENT: Record<string, string> = {
  "anniversary.t-7": "🌸",
  "anniversary.t-1": "🌸",
  "anniversary.today": "🌸",
  "condolence.pending": "💬",
  "member.added": "👤",
  "system.welcome": "✨",
};

const URL_FOR_EVENT = (eventType: string, payload: Record<string, unknown>): string => {
  if (eventType.startsWith("anniversary.")) {
    const memberId = String(payload.memberId ?? "");
    return memberId ? `/memorial/${memberId}` : "/altar";
  }
  if (eventType === "condolence.pending") return "/admin/condolences";
  if (eventType === "member.added") return "/admin/members";
  return "/admin/notifications";
};

const TITLE_FOR_EVENT = (eventType: string, payload: Record<string, unknown>): string => {
  const name = String(payload.memberName ?? "");
  if (eventType === "anniversary.t-7") return `Con 7 ngay toi gio ${name}`;
  if (eventType === "anniversary.t-1") return `Ngay mai la gio ${name}`;
  if (eventType === "anniversary.today") return `Hom nay la gio ${name}`;
  if (eventType === "condolence.pending") return "Loi tuong nho moi cho duyet";
  if (eventType === "member.added") return "Co thanh vien moi";
  if (eventType === "system.welcome") return "Chao mung den voi gia pha";
  return eventType;
};

const POLL_MS = 30 * 1000;

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/notifications/unread.json", { credentials: "same-origin" });
      if (!res.ok) return;
      const json = (await res.json()) as { count: number; items: Item[] };
      setCount(json.count);
      setItems(json.items);
    } catch {
      // Network error -- leave previous state.
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function markAllSeen() {
    await fetch("/api/notifications/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100">
        <span aria-hidden="true">&#128276;</span>
        {count > 0 && (
          <span
            aria-label={`${count} thong bao chua doc`}
            className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span>Thong bao</span>
          {count > 0 && (
            <button
              type="button"
              onClick={markAllSeen}
              className="text-xs text-brand-500 hover:underline"
            >
              Danh dau da doc
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Khong co thong bao.</p>
        ) : (
          <ul aria-live="polite" className="list-none m-0 p-0 max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={URL_FOR_EVENT(item.eventType, item.payload)}
                  className={`block px-3 py-2 text-sm hover:bg-gray-50 ${item.seen ? "text-gray-500" : "font-medium text-gray-800"}`}
                >
                  <span aria-hidden="true" className="mr-2">{ICON_FOR_EVENT[item.eventType] ?? "•"}</span>
                  {TITLE_FOR_EVENT(item.eventType, item.payload)}
                </a>
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator />
        <a
          href="/admin/notifications"
          className="block text-center text-xs text-brand-500 px-3 py-2 hover:underline"
        >
          Xem tat ca &rarr;
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
