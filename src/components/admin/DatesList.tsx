/**
 * Calendar-themed date list. Each card shows the day prominently
 * (large numeric) with a tinted background per type, name vi/en,
 * lunar/solar tag, and recurring badge.
 */
import { useMemo, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type DateRow = {
  id: number;
  date: string;
  calendar: "lunar" | "solar";
  name: string;
  name_en: string;
  type: "memorial" | "festival" | "birthday" | "national" | "anniversary" | "gathering";
  recurring: boolean;
  year: number | null;
};

interface Props {
  items: DateRow[];
}

const TYPE_LABEL: Record<DateRow["type"], string> = {
  memorial: "Giỗ",
  festival: "Lễ hội",
  birthday: "Sinh nhật",
  national: "Quốc gia",
  anniversary: "Kỷ niệm",
  gathering: "Sum họp",
};

const TYPE_ACCENT: Record<DateRow["type"], string> = {
  memorial: "bg-vermilion/10 text-vermilion",
  festival: "bg-gold/15 text-gold-2",
  birthday: "bg-primary/10 text-primary",
  national: "bg-error-50 text-error-700",
  anniversary: "bg-jade/10 text-jade",
  gathering: "bg-secondary text-secondary-foreground",
};

function parseDayMonth(d: string): { day: string; rest: string } {
  // Accepts forms: "DD/MM", "DD-MM", "MM-DD" (calendar attribute decides),
  // "YYYY-MM-DD". Heuristic: pull first numeric token = day, second = month.
  const m = d.match(/(\d{1,2})\D+(\d{1,2})/);
  if (m) return { day: m[1].padStart(2, "0"), rest: `T${m[2].replace(/^0/, "")}` };
  return { day: d.slice(0, 2), rest: d.slice(2) };
}

export default function DatesList({ items }: Props) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | DateRow["type"]>("");
  const [calFilter, setCalFilter] = useState<"" | "lunar" | "solar">("");

  const rows = useMemo(() => {
    return items.filter((d) => {
      if (q) {
        const hay = [d.name, d.name_en, d.date].join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (typeFilter && d.type !== typeFilter) return false;
      if (calFilter && d.calendar !== calFilter) return false;
      return true;
    });
  }, [items, q, typeFilter, calFilter]);

  const onDelete = (d: DateRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa ${d.name}?`)) return;
    toast.info(`Đang xóa #${d.id}…`);
    formEl.submit();
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Chưa có ngày lễ"
        description="Lưu các ngày quan trọng — giỗ tổ, lễ hội, sinh nhật, sum họp."
        action={
          <Button asChild>
            <a href="/admin/dates/new">+ Thêm ngày</a>
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
              placeholder="Tìm theo tên, ngày…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
            {rows.length !== items.length && ` / ${items.length}`} ngày
          </div>
          {(q || typeFilter || calFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setTypeFilter(""); setCalFilter(""); }}>
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Lịch:</span>
          {(["", "lunar", "solar"] as const).map((c) => (
            <Chip key={c || "all"} active={calFilter === c} onClick={() => setCalFilter(c)}>
              {c === "" ? "Tất cả" : c === "lunar" ? "Âm" : "Dương"}
            </Chip>
          ))}
          <span className="ml-3 text-xs text-muted-foreground">Loại:</span>
          {(["", "memorial", "festival", "birthday", "national", "anniversary", "gathering"] as const).map((t) => (
            <Chip key={t || "all"} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {t === "" ? "Tất cả" : TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Search />} title="Không có kết quả" description="Không có ngày nào khớp bộ lọc." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((d) => {
            const { day, rest } = parseDayMonth(d.date);
            return (
              <div
                key={d.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-theme-md"
              >
                <a href={`/admin/dates/${d.id}`} className="block" title={d.name}>
                  <div className={cn("flex items-center gap-3 p-4", TYPE_ACCENT[d.type])}>
                    <div className="flex flex-col items-center justify-center rounded-lg bg-background/80 px-3 py-1.5 backdrop-blur-sm">
                      <span className="text-2xl font-bold tabular-nums leading-none">{day}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-80">{rest}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge variant="outline" className="mb-1 bg-background/60 backdrop-blur-sm">
                        {TYPE_LABEL[d.type]}
                      </Badge>
                      <p className="text-[10px] uppercase tracking-wide opacity-80">
                        {d.calendar === "lunar" ? "Âm lịch" : "Dương lịch"}
                        {d.recurring && " · hằng năm"}
                      </p>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                      {d.name}
                    </h3>
                    {d.name_en && (
                      <p className="line-clamp-1 text-xs italic text-muted-foreground">
                        {d.name_en}
                      </p>
                    )}
                    {d.year && (
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">Từ năm {d.year}</p>
                    )}
                  </div>
                </a>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <form
                    method="post"
                    className="pointer-events-auto"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onDelete(d, e.currentTarget);
                    }}
                  >
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={d.id} />
                    <Button type="submit" variant="destructive" size="sm" className="h-7 px-2.5 text-xs">
                      Xóa
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
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
