/// <reference types="google.maps" />
/**
 * Location list — Table view + Google Map view toggle. Pins on the
 * map are clickable, scrolls table to the matching row.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker, APIProvider, InfoWindow, Map as GMap, useMap,
} from "@vis.gl/react-google-maps";
import { LayoutList, Map as MapIcon, MapPin, Search, Star, X } from "lucide-react";

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
  apiKey?: string;
}

export default function LocationsList({ items, apiKey }: Props) {
  const [q, setQ] = useState("");
  const [provFilter, setProvFilter] = useState("");
  const [hometownOnly, setHometownOnly] = useState(false);
  const [view, setView] = useState<"table" | "map">("table");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const tableRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Scroll the focused row into view when a marker is clicked.
  useEffect(() => {
    if (!focusedId) return;
    const el = tableRowRefs.current.get(focusedId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }, 1800);
    return () => clearTimeout(t);
  }, [focusedId]);

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
          {/* View toggle */}
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title="Xem dạng bảng"
            >
              <LayoutList className="size-3.5" /> Bảng
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title="Xem dạng bản đồ"
            >
              <MapIcon className="size-3.5" /> Bản đồ
            </button>
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
      ) : view === "map" ? (
        apiKey ? (
          <MapView
            apiKey={apiKey}
            rows={rows}
            onMarkerClick={(id) => {
              setFocusedId(id);
              setView("table");
            }}
          />
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm">
            <p className="font-medium text-foreground">Bản đồ chưa được cấu hình</p>
            <p className="text-xs text-muted-foreground">
              Cần đặt biến môi trường <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">PUBLIC_GOOGLE_MAPS_API_KEY</code>.
              Xem hướng dẫn ở <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">.env.example</code>.
            </p>
            <Button variant="outline" size="sm" onClick={() => setView("table")}>
              Quay lại bảng
            </Button>
          </div>
        )
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
                <TableRow
                  key={l.id}
                  ref={(el) => {
                    if (el) tableRowRefs.current.set(l.id, el);
                    else tableRowRefs.current.delete(l.id);
                  }}
                  className={cn(focusedId === l.id && "transition-shadow")}
                >
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

// ─── Google Map view ──────────────────────────────────────────────────────

function MapView({
  apiKey,
  rows,
  onMarkerClick,
}: {
  apiKey: string;
  rows: LocationRow[];
  onMarkerClick: (id: string) => void;
}) {
  const withCoords = rows.filter(
    (r) => typeof r.lat === "number" && typeof r.lng === "number",
  );

  if (withCoords.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="Không có địa điểm có tọa độ"
        description="Sửa các địa điểm và dùng Google Places để tự điền lat/lng."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-theme-xs">
      <APIProvider apiKey={apiKey} libraries={["marker"]} language="vi" region="VN">
        <div className="h-[520px] w-full">
          <GMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: 16.05, lng: 108.21 }}
            defaultZoom={6}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl
          >
            <PinList rows={withCoords} onMarkerClick={onMarkerClick} />
            <FitBounds rows={withCoords} />
          </GMap>
        </div>
      </APIProvider>
      <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <MapPin className="size-3.5" />
        {withCoords.length} pin · {rows.length - withCoords.length} chưa có tọa độ
      </div>
    </div>
  );
}

function PinList({
  rows,
  onMarkerClick,
}: {
  rows: LocationRow[];
  onMarkerClick: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <>
      {rows.map((l) => (
        <AdvancedMarker
          key={l.id}
          position={{ lat: l.lat!, lng: l.lng! }}
          onClick={() => setActiveId(l.id)}
        >
          <div className={l.is_hometown ? "text-vermilion" : "text-jade"}>
            <svg width="32" height="40" viewBox="0 0 24 30" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.4 18.6 0 12 0z" />
              <circle cx="12" cy="12" r="5" fill="white" />
            </svg>
          </div>
        </AdvancedMarker>
      ))}
      {activeId && (() => {
        const l = rows.find((r) => r.id === activeId);
        if (!l) return null;
        return (
          <InfoWindow
            position={{ lat: l.lat!, lng: l.lng! }}
            onCloseClick={() => setActiveId(null)}
            pixelOffset={[0, -36]}
          >
            <div className="w-52">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                {l.is_hometown && <Star className="size-3.5 fill-current text-yellow-500" />}
                {l.name}
              </h4>
              {l.province && (
                <p className="text-xs text-gray-500">{l.province}</p>
              )}
              <p className="mt-1 text-xs font-mono text-gray-500 tabular-nums">
                {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)}
              </p>
              <div className="mt-2 flex gap-1.5">
                <a
                  href={`/admin/locations/${l.id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sửa
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(null);
                    onMarkerClick(l.id);
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-brand-600"
                >
                  Xem trong bảng
                </button>
              </div>
            </div>
          </InfoWindow>
        );
      })()}
    </>
  );
}

function FitBounds({ rows }: { rows: LocationRow[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || rows.length === 0) return;
    if (rows.length === 1) {
      map.setCenter({ lat: rows[0].lat!, lng: rows[0].lng! });
      map.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const l of rows) {
      if (l.lat != null && l.lng != null) {
        bounds.extend({ lat: l.lat, lng: l.lng });
      }
    }
    map.fitBounds(bounds, 64);
  }, [map, rows]);
  return null;
}
