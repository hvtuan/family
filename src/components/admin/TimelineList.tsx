/**
 * Visual timeline card list — replaces the TailAdmin <table>. Cards
 * show cover image (timeline.image) when present, year + title + en
 * subtitle, category badge, and quick edit/delete actions on hover.
 */
import { useMemo, useState } from "react";
import { Calendar, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type TimelineRow = {
  id: number;
  year: number;
  date: string | null;
  lunar: boolean;
  title: string;
  title_en: string;
  category: string | null;
  image: string | null;
};

interface Props {
  items: TimelineRow[];
}

const CAT_LABEL: Record<string, string> = {
  founding: "Khai lập",
  birth: "Sinh",
  marriage: "Hôn nhân",
  death: "Mất",
  milestone: "Cột mốc",
  gathering: "Sum họp",
};

export default function TimelineList({ items }: Props) {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const allCats = useMemo(
    () =>
      Array.from(
        new Set(items.map((t) => t.category).filter((c): c is string => Boolean(c))),
      ).sort(),
    [items],
  );

  const rows = useMemo(() => {
    return items.filter((t) => {
      if (q) {
        const hay = [t.title, t.title_en, String(t.year), t.date ?? ""]
          .join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (catFilter && t.category !== catFilter) return false;
      return true;
    });
  }, [items, q, catFilter]);

  const onDelete = (t: TimelineRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa "${t.title}"?`)) return;
    toast.info(`Đang xóa #${t.id}…`);
    formEl.submit();
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Calendar />}
        title="Chưa có sự kiện nào"
        description="Niên đại lưu lại các mốc quan trọng của gia tộc — sinh, hôn nhân, mất, sum họp…"
        action={
          <Button asChild>
            <a href="/admin/timeline/new">+ Tạo sự kiện</a>
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
              placeholder="Tìm theo tiêu đề, năm…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
            {rows.length !== items.length && ` / ${items.length}`} sự kiện
          </div>
          {(q || catFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCatFilter(""); }}>
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>

        {allCats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Danh mục:</span>
            <Chip active={catFilter === ""} onClick={() => setCatFilter("")}>
              Tất cả
            </Chip>
            {allCats.map((c) => (
              <Chip
                key={c}
                active={catFilter === c}
                onClick={() => setCatFilter(c)}
              >
                {CAT_LABEL[c] ?? c}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Không có kết quả"
          description="Không có sự kiện nào khớp bộ lọc."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-theme-md"
            >
              <a href={`/admin/timeline/${t.id}`} className="block" title={t.title}>
                <div className="aspect-[16/9] bg-muted/40 relative">
                  {t.image ? (
                    <img
                      src={t.image}
                      alt={t.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                      <Calendar className="size-10" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-sm">
                    {t.year}
                    {t.lunar && <span className="text-[10px] opacity-80">âm</span>}
                  </div>
                  {t.category && (
                    <Badge variant="secondary" className="absolute top-2 right-2">
                      {CAT_LABEL[t.category] ?? t.category}
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                    {t.title}
                  </h3>
                  {t.title_en && (
                    <p className="line-clamp-1 text-xs italic text-muted-foreground">
                      {t.title_en}
                    </p>
                  )}
                  {t.date && (
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {t.date}
                    </p>
                  )}
                </div>
              </a>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <form
                  method="post"
                  className="pointer-events-auto"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onDelete(t, e.currentTarget);
                  }}
                >
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="id" value={t.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                  >
                    Xóa
                  </Button>
                </form>
              </div>
            </div>
          ))}
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
