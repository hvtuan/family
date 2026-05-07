/**
 * Users table — shadcn Table with role/status badges + delete action
 * (POSTed natively to /admin/users). The "current user" gets a "bạn"
 * badge and no delete button.
 */
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type UserRow = {
  id: string;
  username: string;
  role: "admin" | "editor" | "branch_editor";
  branch: "noi" | "ngoai" | "both" | null;
  status: "approved" | "pending" | "revoked";
  created_at: string;
  is_me: boolean;
};

interface Props {
  users: UserRow[];
}

const ROLE_LABEL: Record<UserRow["role"], string> = {
  admin: "Quản trị",
  editor: "Biên tập viên",
  branch_editor: "Biên tập theo nhánh",
};

const BRANCH_LABEL: Record<NonNullable<UserRow["branch"]>, string> = {
  noi: "Nội",
  ngoai: "Ngoại",
  both: "Cả hai",
};

const STATUS_VARIANT: Record<
  UserRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending: "secondary",
  revoked: "destructive",
};

const STATUS_LABEL: Record<UserRow["status"], string> = {
  approved: "Đã duyệt",
  pending: "Chờ duyệt",
  revoked: "Đã thu hồi",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function UsersList({ users }: Props) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | UserRow["role"]>("");
  const [statusFilter, setStatusFilter] = useState<"" | UserRow["status"]>("");

  const rows = users.filter((u) => {
    if (q && !u.username.toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  const onDelete = (u: UserRow, formEl: HTMLFormElement) => {
    if (!confirm(`Xóa tài khoản "${u.username}"?`)) return;
    toast.info(`Đang xóa ${u.username}…`);
    formEl.submit();
  };

  if (users.length === 0) {
    return (
      <EmptyState
        title="Chưa có người dùng nào"
        description="Tạo tài khoản đầu tiên ở form bên trên."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên đăng nhập…"
              className="h-10 pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rows.length} / {users.length} người
          </div>
          {(q || roleFilter || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setQ(""); setRoleFilter(""); setStatusFilter(""); }}
            >
              <X className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Vai trò:</span>
          {(["", "admin", "editor", "branch_editor"] as const).map((r) => (
            <Chip key={r || "all"} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
              {r === "" ? "Tất cả" : ROLE_LABEL[r]}
            </Chip>
          ))}
          <span className="ml-3 text-xs text-muted-foreground">Trạng thái:</span>
          {(["", "approved", "pending", "revoked"] as const).map((s) => (
            <Chip key={s || "all"} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === "" ? "Tất cả" : STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Không có kết quả"
          description="Không có người dùng nào khớp bộ lọc."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-theme-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Nhánh</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden md:table-cell">Tạo lúc</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">
                    {u.username}
                    {u.is_me && (
                      <Badge variant="secondary" className="ml-2 font-normal">
                        bạn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.role === "branch_editor" && u.branch ? BRANCH_LABEL[u.branch] : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[u.status]}
                      className={cn(
                        "font-normal",
                        u.status === "approved" && "bg-success-50 text-success-700 hover:bg-success-50",
                      )}
                    >
                      {STATUS_LABEL[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground tabular-nums">
                    {fmtDate(u.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {!u.is_me && (
                      <form
                        method="post"
                        className="inline"
                        onSubmit={(e) => {
                          e.preventDefault();
                          onDelete(u, e.currentTarget);
                        }}
                      >
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="user_id" value={u.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          Xóa
                        </Button>
                      </form>
                    )}
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
