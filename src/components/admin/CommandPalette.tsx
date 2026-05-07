/**
 * Global command palette — Cmd/Ctrl+K opens a fuzzy-searchable launcher
 * across admin pages, photos, members, traditions, locations, timeline
 * events, and quotes.
 *
 * Mounted once in AdminLayout. Single fetch of /admin/search.json on
 * first open returns all entities in one round-trip.
 */
import { useEffect, useState } from "react";
import {
  Calendar, CalendarDays, ChartBar, Image as ImageIcon, LogOut,
  Map as MapIcon, MapPin, MessageSquareQuote, ScrollText, Settings,
  Sparkles, Star, Users,
} from "lucide-react";

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";

type Photo = { id: string; kind: "image" | "video"; src: string; src_thumb: string | null; alt_vi: string | null; caption: string; year: number | null };
type Member = { id: string; name: string; name_en: string | null; gen: number; role: string; photo: string | null };
type Tradition = { id: string; name: string; name_en: string; category: string; icon: string; image: string | null };
type Location = { id: string; name: string; name_en: string; province: string | null; is_hometown: boolean };
type Timeline = { id: number; title: string; title_en: string; year: number; date: string | null; category: string | null };
type Quote = { id: number; text_vi: string; author: string; type: string };

type SearchData = {
  members: Member[];
  photos: Photo[];
  traditions: Tradition[];
  locations: Location[];
  timeline: Timeline[];
  quotes: Quote[];
};

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: ChartBar, kbd: "1" },
  { href: "/admin/members", label: "Thành viên", icon: Users, kbd: "2" },
  { href: "/admin/timeline", label: "Niên đại", icon: Calendar, kbd: "3" },
  { href: "/admin/traditions", label: "Truyền thống", icon: ScrollText, kbd: "4" },
  { href: "/admin/media", label: "Thư viện ảnh", icon: ImageIcon, kbd: "5" },
  { href: "/admin/quotes", label: "Câu nói", icon: Sparkles, kbd: "6" },
  { href: "/admin/dates", label: "Ngày lễ", icon: CalendarDays, kbd: "7" },
  { href: "/admin/locations", label: "Địa điểm", icon: MapIcon, kbd: "8" },
  { href: "/admin/users", label: "Người dùng", icon: Settings, kbd: "9" },
  { href: "/admin/audit", label: "Nhật ký", icon: ScrollText, kbd: "0" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K toggles the palette globally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-fetch on first open.
  useEffect(() => {
    if (!open || data !== null) return;
    setLoading(true);
    fetch("/admin/search.json", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData({
            members: d.members,
            photos: d.photos,
            traditions: d.traditions,
            locations: d.locations,
            timeline: d.timeline,
            quotes: d.quotes,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, data]);

  const goto = (href: string) => {
    setOpen(false);
    location.href = href;
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Tìm trang, ảnh, thành viên, địa điểm… (Esc để đóng)" />
      <CommandList>
        <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>

        <CommandGroup heading="Trang admin">
          {NAV_ITEMS.map((nav) => {
            const Icon = nav.icon;
            return (
              <CommandItem
                key={nav.href}
                value={`page ${nav.label} ${nav.href}`}
                onSelect={() => goto(nav.href)}
              >
                <Icon />
                <span>{nav.label}</span>
                <CommandShortcut>{nav.href.replace("/admin/", "")}</CommandShortcut>
              </CommandItem>
            );
          })}
          <CommandItem value="logout" onSelect={() => goto("/admin/logout")}>
            <LogOut />
            <span>Đăng xuất</span>
          </CommandItem>
        </CommandGroup>

        {data?.members && data.members.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Thành viên (${data.members.length})`}>
              {data.members.slice(0, 30).map((m) => (
                <CommandItem
                  key={m.id}
                  value={`member ${m.id} ${m.name} ${m.name_en ?? ""} ${m.role} đời ${m.gen}`}
                  onSelect={() => goto(`/admin/members/${m.id}`)}
                >
                  {m.photo ? (
                    <img
                      src={m.photo}
                      alt=""
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {m.name[0]}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Đời {m.gen} · {m.role}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data?.photos && data.photos.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Ảnh / video (${data.photos.length})`}>
              {data.photos.slice(0, 30).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`media ${p.id} ${p.caption} ${p.alt_vi ?? ""} ${p.year ?? ""}`}
                  onSelect={() => goto(`/admin/media/${p.id}`)}
                >
                  {p.src_thumb || p.src ? (
                    <img
                      src={p.src_thumb || p.src}
                      alt=""
                      className="size-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <ImageIcon />
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{p.alt_vi ?? p.caption}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.kind === "video" ? "🎬 video" : "🖼️ ảnh"}
                      {p.year ? ` · ${p.year}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data?.locations && data.locations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Địa điểm (${data.locations.length})`}>
              {data.locations.slice(0, 20).map((l) => (
                <CommandItem
                  key={l.id}
                  value={`location ${l.id} ${l.name} ${l.name_en} ${l.province ?? ""}`}
                  onSelect={() => goto(`/admin/locations/${l.id}`)}
                >
                  <MapPin className="text-jade" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium inline-flex items-center gap-1.5">
                      {l.is_hometown && <Star className="size-3 fill-current text-yellow-500" />}
                      {l.name}
                    </span>
                    {l.province && (
                      <span className="text-xs text-muted-foreground">{l.province}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data?.traditions && data.traditions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Truyền thống (${data.traditions.length})`}>
              {data.traditions.slice(0, 20).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`tradition ${t.id} ${t.name} ${t.name_en} ${t.category}`}
                  onSelect={() => goto(`/admin/traditions/${t.id}`)}
                >
                  {t.image ? (
                    <img src={t.image} alt="" className="size-8 shrink-0 rounded object-cover" />
                  ) : (
                    <ScrollText />
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.category}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data?.timeline && data.timeline.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Niên đại (${data.timeline.length})`}>
              {data.timeline.slice(0, 20).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`timeline ${t.id} ${t.title} ${t.title_en} năm ${t.year}`}
                  onSelect={() => goto(`/admin/timeline/${t.id}`)}
                >
                  <Calendar />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.year}
                      {t.date ? ` · ${t.date}` : ""}
                      {t.category ? ` · ${t.category}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data?.quotes && data.quotes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Câu nói (${data.quotes.length})`}>
              {data.quotes.slice(0, 20).map((q) => (
                <CommandItem
                  key={q.id}
                  value={`quote ${q.id} ${q.text_vi} ${q.author}`}
                  onSelect={() => goto(`/admin/quotes/${q.id}`)}
                >
                  <MessageSquareQuote />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm line-clamp-1 font-medium italic">
                      "{q.text_vi.length > 70 ? `${q.text_vi.slice(0, 70)}…` : q.text_vi}"
                    </span>
                    <span className="text-xs text-muted-foreground">— {q.author}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {loading && data === null && (
          <CommandGroup>
            <CommandItem disabled value="loading">
              Đang tải dữ liệu…
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
