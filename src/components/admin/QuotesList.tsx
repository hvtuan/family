/**
 * Quote card grid — text-heavy items deserve typographic treatment over
 * a thumbnail. Each card displays the quote in serif italic with a
 * leading large-size opening glyph, attribution, and type badge.
 */
import { useMemo, useState } from "react";
import { MessageSquareQuote, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type QuoteRow = {
  id: number;
  text_vi: string;
  text_en: string | null;
  author: string;
  type: "proverb" | "family" | "poem" | "letter";
  context: string | null;
};

interface Props {
  items: QuoteRow[];
}

const TYPE_LABEL: Record<QuoteRow["type"], string> = {
  proverb: "Tục ngữ",
  family: "Lời gia đình",
  poem: "Thơ",
  letter: "Thư",
};

const TYPE_TINT: Record<QuoteRow["type"], string> = {
  proverb: "from-jade/10 to-jade/5",
  family: "from-vermilion/10 to-vermilion/5",
  poem: "from-gold/10 to-gold/5",
  letter: "from-paper-2 to-cream",
};

export default function QuotesList({ items }: Props) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | QuoteRow["type"]>("");

  const rows = useMemo(() => {
    return items.filter((qq) => {
      if (q) {
        const hay = [qq.text_vi, qq.text_en ?? "", qq.author, qq.context ?? ""]
          .join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (typeFilter && qq.type !== typeFilter) return false;
      return true;
    });
  }, [items, q, typeFilter]);

  const onDelete = (qq: QuoteRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa câu này của ${qq.author}?`)) return;
    toast.info(`Đang xóa #${qq.id}…`);
    formEl.submit();
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareQuote />}
        title="Chưa có câu nói nào"
        description="Lưu lại tục ngữ, lời ông bà, thơ, thư — những lời nói đáng nhớ của gia tộc."
        action={
          <Button asChild>
            <a href="/admin/quotes/new">+ Thêm câu nói</a>
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
              placeholder="Tìm theo nội dung, tác giả…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
            {rows.length !== items.length && ` / ${items.length}`} câu
          </div>
          {(q || typeFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setTypeFilter(""); }}>
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Loại:</span>
          {(["", "proverb", "family", "poem", "letter"] as const).map((t) => (
            <Chip
              key={t || "all"}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            >
              {t === "" ? "Tất cả" : TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Không có kết quả"
          description="Không có câu nói nào khớp bộ lọc."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((qq) => (
            <div
              key={qq.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-theme-md"
            >
              <a href={`/admin/quotes/${qq.id}`} className="block p-5" title={`Sửa câu #${qq.id}`}>
                <div className={cn(
                  "relative -m-5 mb-4 bg-gradient-to-br p-5 pb-6 pl-12",
                  TYPE_TINT[qq.type],
                )}>
                  <span className="absolute left-3 top-1 font-display text-5xl leading-none text-foreground/30 select-none">
                    "
                  </span>
                  <p className="font-display text-base italic leading-relaxed text-foreground line-clamp-3">
                    {qq.text_vi}
                  </p>
                  {qq.text_en && (
                    <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">
                      {qq.text_en}
                    </p>
                  )}
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      — {qq.author}
                    </p>
                    {qq.context && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {qq.context}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {TYPE_LABEL[qq.type]}
                  </Badge>
                </div>
              </a>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <form
                  method="post"
                  className="pointer-events-auto"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onDelete(qq, e.currentTarget);
                  }}
                >
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="id" value={qq.id} />
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
