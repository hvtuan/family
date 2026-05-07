/**
 * Location list — uses shadcn Table since locations are tabular
 * (name / province / coords / hometown). Map decorative pin icon
 * accents the row.
 */
import { useMemo, useState } from "react";
import { MapPin, Search, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type LocationRow = {
  id: string;
  name: string;
  name_en: string;
  province: string | null;
  lat: number | null;
  lng: number | null;
  is_hometown: boolean;
};

interface Props {
  items: LocationRow[];
}

export default function LocationsList({ items }: Props) {
  const [q, setQ] = useState("");
  const [provFilter, setProvFilter] = useState("");
  const [hometownOnly, setHometownOnly] = useState(false);

  const allProvinces = useMemo(
    () =>
      Array.from(
        new Set(items.map((l) => l.province).filter((p): p is string => Boolean(p))),
      ).sort(),
    [items],
  );

  const rows = useMemo(() => {
    return items.filter((l) => {
      if (q) {
        const hay = [l.name, l.name_en, l.province ?? "", l.id].join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (provFilter && l.province !== provFilter) return false;
      if (hometownOnly && !l.is_hometown) return false;
      return true;
    });
  }, [items, q, provFilter, hometownOnly]);

  const onDelete = (l: LocationRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa ${l.name}?`)) return;
    toast.info(`Đang xóa ${l.name}…`);
    formEl.submit();
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="Chưa có địa điểm"
        description="Lưu các địa điểm gắn với gia tộc — quê nhà, nơi sinh sống, nơi an táng."
        action={
          <Button asChild>
            <a href="/admin/locations/new">+ Thêm địa điểm</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, tỉnh…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
            {rows.length !== items.length && ` / ${items.length}`} địa điểm
          </div>
          {(q || provFilter || hometownOnly) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setProvFilter(""); setHometownOnly(false); }}>
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={hometownOnly} onClick={() => setHometownOnly((v) => !v)}>
            <Star className={cn("size-3", hometownOnly && "fill-current")} /> Quê nhà
          </Chip>
          {allProvinces.length > 0 && (
            <>
              <span className="ml-3 text-xs text-muted-foreground">Tỉnh:</span>
              <Chip active={provFilter === ""} onClick={() => setProvFilter("")}>
                Tất cả
              </Chip>
              {allProvinces.map((p) => (
                <Chip key={p} active={provFilter === p} onClick={() => setProvFilter(p)}>
                  {p}
                </Chip>
              ))}
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Search />} title="Không có kết quả" description="Không có địa điểm nào khớp bộ lọc." />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-theme-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Tên địa điểm</TableHead>
                <TableHead>Tỉnh</TableHead>
                <TableHead className="hidden md:table-cell">Tọa độ</TableHead>
                <TableHead>Quê nhà</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <a href={`/admin/locations/${l.id}`} className="group flex items-center gap-2.5 -m-1 p-1 rounded-md">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-jade/10 text-jade">
                        <MapPin className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground group-hover:text-primary truncate">
                          {l.name}
                        </div>
                        {l.name_en && (
                          <div className="text-xs italic text-muted-foreground truncate">
                            {l.name_en}
                          </div>
                        )}
                      </div>
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.province ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground tabular-nums">
                    {l.lat != null && l.lng != null ? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {l.is_hometown && (
                      <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 ring-1 ring-yellow-200 border-transparent">
                        <Star className="size-3 fill-current mr-1" />
                        Quê nhà
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/admin/locations/${l.id}`}>Sửa</a>
                      </Button>
                      <form
                        method="post"
                        className="inline"
                        onSubmit={(e) => {
                          e.preventDefault();
                          onDelete(l, e.currentTarget);
                        }}
                      >
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={l.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          Xóa
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
