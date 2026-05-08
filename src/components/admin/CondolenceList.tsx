/**
 * Admin moderation queue for "Lời tưởng nhớ".
 *
 * Tabs by status (Pending / Approved / Rejected). Bulk approve/reject via
 * checkboxes. Click a row → Sheet drawer with full body + member context.
 */
import { useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pickLocale, type Localized } from "@/i18n";

export type AdminCondolence = {
  id: number;
  memberId: string;
  memberName: string;
  visitorName: string;
  visitorRelation: string | null;
  body: Localized<string>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
};

interface Props {
  initial: {
    pending: AdminCondolence[];
    approved: AdminCondolence[];
    rejected: AdminCondolence[];
  };
}

export default function CondolenceList({ initial }: Props) {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drawerItem, setDrawerItem] = useState<AdminCondolence | null>(null);
  const [busy, setBusy] = useState(false);

  const current = data[tab];
  const counts = useMemo(
    () => ({
      pending: data.pending.length,
      approved: data.approved.length,
      rejected: data.rejected.length,
    }),
    [data]
  );

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === current.length) setSelected(new Set());
    else setSelected(new Set(current.map((c) => c.id)));
  }

  async function moderateMany(ids: number[], action: "approve" | "reject") {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/admin/condolences/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) {
        toast.error("Có lỗi khi xử lý");
        setBusy(false);
        return;
      }
      // Optimistic state move
      setData((prev) => {
        const moving = current.filter((c) => ids.includes(c.id)).map((c) => ({
          ...c,
          status: action === "approve" ? ("approved" as const) : ("rejected" as const),
          reviewedAt: new Date().toISOString(),
        }));
        return {
          ...prev,
          [tab]: prev[tab].filter((c) => !ids.includes(c.id)),
          [action === "approve" ? "approved" : "rejected"]: [
            ...moving,
            ...prev[action === "approve" ? "approved" : "rejected"],
          ],
        };
      });
      setSelected(new Set());
      setDrawerItem(null);
      toast.success(`Đã ${action === "approve" ? "duyệt" : "từ chối"} ${ids.length} mục`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="pending">Chờ duyệt ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Đã duyệt ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Đã từ chối ({counts.rejected})</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as const).map((s) => (
          <TabsContent key={s} value={s}>
            {data[s].length === 0 ? (
              <Card className="p-8 text-center text-sm text-gray-500 mt-4">
                Không có mục nào.
              </Card>
            ) : (
              <div className="mt-4 grid gap-3">
                {s === "pending" && data[s].length > 0 && (
                  <div className="flex items-center gap-3 px-2">
                    <Checkbox
                      checked={selected.size === current.length && current.length > 0}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-xs text-gray-500">
                      {selected.size > 0 ? `${selected.size} đã chọn` : "Chọn tất cả"}
                    </span>
                    {selected.size > 0 && (
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => moderateMany([...selected], "approve")}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs rounded bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                        >
                          Duyệt {selected.size} mục
                        </button>
                        <button
                          onClick={() => moderateMany([...selected], "reject")}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <ul className="grid gap-3 list-none p-0 m-0">
                  {data[s].map((c) => (
                    <li key={c.id}>
                      <Card className="p-4 flex items-start gap-3 hover:bg-gray-50 cursor-pointer" onClick={() => setDrawerItem(c)}>
                        {s === "pending" && (
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggle(c.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800">{c.visitorName}</span>
                            {c.visitorRelation && (
                              <span className="text-xs text-gray-500">· {c.visitorRelation}</span>
                            )}
                            <span className="text-xs text-gray-400">→ {c.memberName}</span>
                            <Badge variant={statusVariant(c.status)} className="ml-auto text-xs">
                              {statusLabel(c.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2 m-0">
                            {pickLocale(c.body, "vi") ?? ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 m-0 tabular-nums">
                            {fmtDateTime(c.createdAt)}
                          </p>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Sheet open={drawerItem !== null} onOpenChange={(o) => !o && setDrawerItem(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lời tưởng nhớ</SheetTitle>
          </SheetHeader>

          {drawerItem && (
            <div className="mt-6 grid gap-4">
              <div>
                <p className="text-xs text-gray-500 m-0">Người gửi</p>
                <p className="font-semibold text-gray-800 m-0">
                  {drawerItem.visitorName}
                  {drawerItem.visitorRelation && (
                    <span className="text-sm text-gray-500 ml-2">· {drawerItem.visitorRelation}</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 m-0">Tưởng niệm</p>
                <p className="font-semibold text-gray-800 m-0">
                  <a
                    href={`/memorial/${drawerItem.memberId}`}
                    target="_blank"
                    className="text-brand-500 hover:underline"
                  >
                    {drawerItem.memberName} ↗
                  </a>
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 m-0">Nội dung</p>
                <p className="text-gray-800 m-0 mt-1 leading-relaxed whitespace-pre-line">
                  {pickLocale(drawerItem.body, "vi") ?? ""}
                </p>
              </div>

              <div className="text-xs text-gray-400 tabular-nums">
                Gửi lúc: {fmtDateTime(drawerItem.createdAt)}
              </div>

              {drawerItem.status === "pending" && (
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => moderateMany([drawerItem.id], "approve")}
                    disabled={busy}
                    className="flex-1 px-4 py-2 rounded bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                  >
                    Duyệt
                  </button>
                  <button
                    onClick={() => moderateMany([drawerItem.id], "reject")}
                    disabled={busy}
                    className="flex-1 px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function statusLabel(s: string): string {
  if (s === "pending") return "Chờ duyệt";
  if (s === "approved") return "Đã duyệt";
  return "Đã từ chối";
}

function statusVariant(s: string): "default" | "outline" | "destructive" | "secondary" {
  if (s === "approved") return "default";
  if (s === "rejected") return "outline";
  return "secondary";
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
