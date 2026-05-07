/**
 * Global command palette — Cmd/Ctrl+K opens a fuzzy-searchable launcher
 * across admin pages, photos, and members.
 *
 * Mounted once in AdminLayout. Lazy-fetches /admin/media/list.json +
 * /admin/members/list.json on first open and caches in-memory.
 */
import { useEffect, useState } from "react";
import {
  Calendar, ChartBar, Image as ImageIcon, LogOut, Map as MapIcon,
  ScrollText, Settings, Sparkles, Users,
} from "lucide-react";

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";

type Photo = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  alt_vi: string | null;
  caption: string;
  year: number | null;
};

type Member = {
  id: string;
  name: string;
  name_en: string | null;
  gen: number;
  role: string;
  photo: string | null;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: ChartBar },
  { href: "/admin/members", label: "Thành viên", icon: Users },
  { href: "/admin/timeline", label: "Niên đại", icon: Calendar },
  { href: "/admin/traditions", label: "Truyền thống", icon: ScrollText },
  { href: "/admin/media", label: "Thư viện ảnh", icon: ImageIcon },
  { href: "/admin/quotes", label: "Câu nói", icon: Sparkles },
  { href: "/admin/dates", label: "Ngày lễ", icon: Calendar },
  { href: "/admin/locations", label: "Địa điểm", icon: MapIcon },
  { href: "/admin/users", label: "Người dùng", icon: Settings },
  { href: "/admin/audit", label: "Nhật ký", icon: ScrollText },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
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
    if (!open || (photos !== null && members !== null)) return;
    setLoading(true);
    Promise.all([
      fetch("/admin/media/list.json", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => (d.ok ? (d.photos as Photo[]) : []))
        .catch(() => []),
      fetch("/admin/members/list.json", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => (d.ok ? (d.members as Member[]) : []))
        .catch(() => []),
    ]).then(([ph, mb]) => {
      setPhotos(ph);
      setMembers(mb);
      setLoading(false);
    });
  }, [open, photos, members]);

  const goto = (href: string) => {
    setOpen(false);
    location.href = href;
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Tìm trang, ảnh, thành viên… (Esc để đóng)" />
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
                <CommandShortcut>
                  {nav.href.replace("/admin", "/admin")}
                </CommandShortcut>
              </CommandItem>
            );
          })}
          <CommandItem value="logout" onSelect={() => goto("/admin/logout")}>
            <LogOut />
            <span>Đăng xuất</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={`Thành viên${members ? ` (${members.length})` : ""}`}>
          {loading && !members && (
            <CommandItem disabled value="loading-members">
              Đang tải…
            </CommandItem>
          )}
          {(members ?? []).slice(0, 30).map((m) => (
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

        <CommandSeparator />

        <CommandGroup heading={`Ảnh / video${photos ? ` (${photos.length})` : ""}`}>
          {loading && !photos && (
            <CommandItem disabled value="loading-photos">
              Đang tải…
            </CommandItem>
          )}
          {(photos ?? []).slice(0, 30).map((p) => (
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
      </CommandList>
    </CommandDialog>
  );
}
