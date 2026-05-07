/**
 * Visual traditions card grid — replaces the TailAdmin <table>. Shows
 * cover image when present, otherwise a large icon emoji from the
 * tradition.icon field.
 */
import { useMemo, useState } from "react";
import { Search, ScrollText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type TraditionRow = {
  id: string;
  name: string;
  name_en: string;
  category: string;
  icon: string;
  image: string | null;
  tags: string[];
};

interface Props {
  items: TraditionRow[];
}

const CAT_LABEL: Record<string, string> = {
  food: "Ẩm thực",
  festival: "Lễ hội",
  ceremony: "Nghi lễ",
  craft: "Nghề",
};

const ICON_EMOJI: Record<string, string> = {
  bowl: "🥣",
  fish: "🐟",
  leaf: "🍃",
  shell: "🐚",
  incense: "🕯️",
  blossom: "🌸",
};

export default function TraditionsList({ items }: Props) {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const allCats = useMemo(
    () => Array.from(new Set(items.map((t) => t.category))).sort(),
    [items],
  );

  const rows = useMemo(() => {
    return items.filter((t) => {
      if (q) {
        const hay = [t.name, t.name_en, t.id, ...t.tags]
          .join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (catFilter && t.category !== catFilter) return false;
      return true;
    });
  }, [items, q, catFilter]);

  const onDelete = (t: TraditionRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa "${t.name}"?`)) return;
    toast.info(`Đang xóa ${t.name}…`);
    formEl.submit();
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText />}
        title="Chưa có truyền thống"
        description="Lưu lại các giá trị văn hóa của gia tộc — món ăn, lễ hội, nghi lễ, nghề."
        action={
          <Button asChild>
            <a href="/admin/traditions/new">+ Thêm truyền thống</a>
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
              placeholder="Tìm theo tên, tag…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
            {rows.length !== items.length && ` / ${items.length}`} mục
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
          description="Không có truyền thống nào khớp bộ lọc."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-theme-md"
            >
              <a href={`/admin/traditions/${t.id}`} className="block" title={t.name}>
                <div className="aspect-[4/3] bg-gradient-to-br from-paper-2 to-cream relative">
                  {t.image ? (
                    <img
                      src={t.image}
                      alt={t.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl opacity-80">
                      {ICON_EMOJI[t.icon] ?? "🏵️"}
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute top-2 right-2 backdrop-blur-sm">
                    {CAT_LABEL[t.category] ?? t.category}
                  </Badge>
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                    {t.name}
                  </h3>
                  {t.name_en && (
                    <p className="line-clamp-1 text-xs italic text-muted-foreground">
                      {t.name_en}
                    </p>
                  )}
                  {t.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
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
