/**
 * Audit log viewer — shadcn Table + filter chips. The diff column
 * still uses native <details> so opening doesn't blow up the row.
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type AuditEvent = {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  diff: unknown;
  at: string;
};

interface Props {
  events: AuditEvent[];
  /** Available entity options — passed in so we don't hardcode here too. */
  entities: string[];
}

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  insert: "default",
  create: "default",
  approve: "default",
  update: "secondary",
  login: "outline",
  logout: "outline",
  delete: "destructive",
  revoke: "destructive",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "Thêm",
  create: "Tạo",
  approve: "Duyệt",
  update: "Sửa",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  delete: "Xóa",
  revoke: "Thu hồi",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditList({ events, entities }: Props) {
  const [q, setQ] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const allActions = useMemo(
    () => Array.from(new Set(events.map((e) => e.action))).sort(),
    [events],
  );

  const rows = useMemo(() => {
    return events.filter((e) => {
      if (q) {
        const hay = [e.actor, e.entity_type, e.entity_id ?? ""]
          .join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (entityFilter && e.entity_type !== entityFilter) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      return true;
    });
  }, [events, q, entityFilter, actionFilter]);

  const hasFilter = !!(q || entityFilter || actionFilter);
  const clearAll = () => {
    setQ("");
    setEntityFilter("");
    setActionFilter("");
  };

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
              placeholder="Tìm theo người dùng, entity_id…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length} / {events.length} sự kiện
          </div>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Bảng:</span>
          <Chip active={entityFilter === ""} onClick={() => setEntityFilter("")}>
            Tất cả
          </Chip>
          {entities.map((e) => (
            <Chip
              key={e}
              active={entityFilter === e}
              onClick={() => setEntityFilter(e)}
            >
              {e}
            </Chip>
          ))}
        </div>

        {allActions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Hành động:</span>
            <Chip active={actionFilter === ""} onClick={() => setActionFilter("")}>
              Tất cả
            </Chip>
            {allActions.map((a) => (
              <Chip
                key={a}
                active={actionFilter === a}
                onClick={() => setActionFilter(a)}
              >
                {ACTION_LABEL[a] ?? a}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={events.length === 0 ? "Chưa có sự kiện nào" : "Không có kết quả"}
          description={
            events.length === 0
              ? "Trigger DB tự ghi cho mọi insert/update/delete trên content tables."
              : "Không có sự kiện nào khớp bộ lọc."
          }
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-theme-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="whitespace-nowrap">Lúc</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Bảng</TableHead>
                <TableHead>ID đối tượng</TableHead>
                <TableHead>Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const variant = ACTION_VARIANT[e.action] ?? "outline";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {fmtDate(e.at)}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{e.actor}</TableCell>
                    <TableCell>
                      <Badge
                        variant={variant}
                        className={cn(
                          "font-normal",
                          variant === "default" && "bg-success-50 text-success-700 hover:bg-success-50",
                        )}
                      >
                        {ACTION_LABEL[e.action] ?? e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {e.entity_type}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {e.entity_id ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {e.diff ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary hover:underline">
                            xem
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                            {JSON.stringify(e.diff, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
