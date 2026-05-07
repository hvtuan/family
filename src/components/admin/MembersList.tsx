/**
 * Visual-first member list. Grid of cards (avatar + name + meta + quick
 * actions on hover) grouped by generation, with chip filters + search.
 *
 * Replaces the old TailAdmin <table> view. Same data fetched server-side
 * by the Astro page; this island only handles client filtering + UI.
 *
 * Delete still posts natively to the parent /admin/members POST handler;
 * the island just builds the form for confirmation.
 */
import { useMemo, useState } from "react";
import { Crown, Search, User, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type MemberCardRow = {
  id: string;
  name: string;
  name_en: string | null;
  gen: number;
  role: string;
  branch: "noi" | "ngoai" | "both";
  born: string;
  died: string | null;
  status: "draft" | "published";
  is_family_head: boolean;
  photo: string | null;
};

interface Props {
  items: MemberCardRow[];
}

const BRANCH_LABEL: Record<MemberCardRow["branch"], string> = {
  noi: "Nội",
  ngoai: "Ngoại",
  both: "Cả",
};

export default function MembersList({ items }: Props) {
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState<"" | MemberCardRow["branch"]>("");
  const [genFilter, setGenFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">("");

  const allGens = useMemo(
    () => Array.from(new Set(items.map((m) => m.gen))).sort((a, b) => a - b),
    [items],
  );

  const rows = useMemo(() => {
    return items.filter((m) => {
      if (q) {
        const hay = [m.name, m.name_en ?? "", m.id, m.role].join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (branchFilter && m.branch !== branchFilter) return false;
      if (genFilter !== "" && m.gen !== genFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      return true;
    });
  }, [items, q, branchFilter, genFilter, statusFilter]);

  // Group by generation for visual structure.
  const grouped = useMemo(() => {
    const map = new Map<number, MemberCardRow[]>();
    for (const m of rows) {
      if (!map.has(m.gen)) map.set(m.gen, []);
      map.get(m.gen)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rows]);

  const hasFilter = !!(q || branchFilter || genFilter !== "" || statusFilter);
  const clearAll = () => {
    setQ("");
    setBranchFilter("");
    setGenFilter("");
    setStatusFilter("");
  };

  const onDelete = (m: MemberCardRow, formEl: HTMLFormElement) => {
    if (
      !confirm(
        `Xóa ${m.name}? Quan hệ cha/mẹ ở các thành viên khác sẽ tự bỏ tham chiếu.`,
      )
    ) {
      return false;
    }
    // Optimistic toast — actual server response renders the page banner
    // (which becomes another toast via ToastBanner) on reload.
    toast.info(`Đang xóa ${m.name}…`);
    formEl.submit();
    return true;
  };

  return (
    <div className="space-y-6">
      <FilterBar
        q={q}
        setQ={setQ}
        rowsCount={rows.length}
        totalCount={items.length}
        hasFilter={hasFilter}
        clearAll={clearAll}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        gens={allGens}
        genFilter={genFilter}
        setGenFilter={setGenFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {rows.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Chưa có thành viên"
            description="Thêm thành viên đầu tiên để bắt đầu xây dựng cây gia phả."
            action={
              <Button asChild>
                <a href="/admin/members/new">+ Thêm thành viên</a>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Search />}
            title="Không có kết quả"
            description="Không có thành viên nào khớp bộ lọc."
            action={
              <Button variant="outline" onClick={clearAll}>
                <X className="size-4" /> Xóa lọc
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-8">
          {grouped.map(([gen, members]) => (
            <section key={gen}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-foreground">Đời {gen}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({members.length} người)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {members.map((m) => (
                  <MemberCard key={m.id} m={m} onDelete={onDelete} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  m,
  onDelete,
}: {
  m: MemberCardRow;
  onDelete: (m: MemberCardRow, formEl: HTMLFormElement) => boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-theme-md">
      <a
        href={`/admin/members/${m.id}`}
        className="block"
        title={`Sửa ${m.name}`}
      >
        <div className="aspect-[4/3] bg-muted/40 relative">
          {m.photo ? (
            <img
              src={m.photo}
              alt={m.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-display text-muted-foreground/50">
              <span aria-hidden>{m.name[0]}</span>
            </div>
          )}
          {m.is_family_head && (
            <span
              className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-700 ring-1 ring-yellow-200"
              title="Tộc trưởng"
            >
              <Crown className="size-3 fill-current" />
              Tộc trưởng
            </span>
          )}
          <span
            className={cn(
              "absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
              m.status === "published"
                ? "bg-success-50 text-success-700 ring-success-100"
                : "bg-gray-100 text-gray-600 ring-gray-200",
            )}
          >
            {m.status === "published" ? "Đã xuất bản" : "Bản nháp"}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {m.name}
              </h3>
              {m.name_en && (
                <p className="truncate text-xs italic text-muted-foreground">
                  {m.name_en}
                </p>
              )}
            </div>
            <Badge variant="outline" className="shrink-0">
              {BRANCH_LABEL[m.branch]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{m.role}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {m.born}
            {m.died ? ` – ${m.died}` : ""}
          </p>
        </div>
      </a>

      {/* Quick actions revealed on hover, not affecting card click. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <form
          method="post"
          className="pointer-events-auto"
          onSubmit={(e) => {
            e.preventDefault();
            onDelete(m, e.currentTarget);
          }}
        >
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="id" value={m.id} />
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
  );
}

function FilterBar(props: {
  q: string;
  setQ: (v: string) => void;
  rowsCount: number;
  totalCount: number;
  hasFilter: boolean;
  clearAll: () => void;
  branchFilter: "" | MemberCardRow["branch"];
  setBranchFilter: (b: "" | MemberCardRow["branch"]) => void;
  gens: number[];
  genFilter: number | "";
  setGenFilter: (g: number | "") => void;
  statusFilter: "" | "published" | "draft";
  setStatusFilter: (s: "" | "published" | "draft") => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={props.q}
            onChange={(e) => props.setQ(e.target.value)}
            placeholder="Tìm theo tên, tên latin, vai vế…"
            className="h-10 pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {props.rowsCount}
          {props.rowsCount !== props.totalCount && ` / ${props.totalCount}`} người
        </div>
        {props.hasFilter && (
          <Button variant="ghost" size="sm" onClick={props.clearAll}>
            <X className="size-4" /> Xóa lọc
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Nhánh:</span>
        {(["", "noi", "ngoai", "both"] as const).map((b) => (
          <Chip
            key={b || "all"}
            active={props.branchFilter === b}
            onClick={() => props.setBranchFilter(b)}
          >
            {b === "" ? "Tất cả" : BRANCH_LABEL[b]}
          </Chip>
        ))}

        {props.gens.length > 0 && (
          <>
            <span className="ml-3 text-xs text-muted-foreground">Đời:</span>
            <Chip
              active={props.genFilter === ""}
              onClick={() => props.setGenFilter("")}
            >
              Tất cả
            </Chip>
            {props.gens.map((g) => (
              <Chip
                key={g}
                active={props.genFilter === g}
                onClick={() => props.setGenFilter(g)}
              >
                Đời {g}
              </Chip>
            ))}
          </>
        )}

        <span className="ml-3 text-xs text-muted-foreground">Trạng thái:</span>
        {(["", "published", "draft"] as const).map((s) => (
          <Chip
            key={s || "all"}
            active={props.statusFilter === s}
            onClick={() => props.setStatusFilter(s)}
          >
            {s === "" ? "Tất cả" : s === "published" ? "Đã xuất bản" : "Bản nháp"}
          </Chip>
        ))}
      </div>
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
