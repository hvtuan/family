/**
 * Right-column sidebar of /admin/media/[id]. React island so we can use
 * shadcn Tabs + Input + Label + Textarea + Checkbox + Card; the <form>
 * still posts natively to the current URL (action=save / delete) so the
 * Astro page handler stays in charge of validation + DB writes.
 *
 * Sections are organized into Tabs ("Mô tả", "Thông tin file", "URL")
 * so the dense single-stack of fields no longer overwhelms the user.
 */
import { useMemo, useState } from "react";
import { Calendar, FileImage, Hash, Link as LinkIcon, MapPin, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

export type DetailMember = { id: string; name: string; gen: number };

export type DetailPhoto = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  src_medium: string | null;
  caption: string;
  caption_en: string;
  alt_vi: string | null;
  alt_en: string | null;
  year: number | null;
  date: string | null;
  location: string | null;
  album: string | null;
  featured: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  duration_seconds: number | null;
  tags: string[];
};

interface Props {
  photo: DetailPhoto;
  members: DetailMember[];
  selectedMembers: string[];
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MediaDetailSidebar({ photo: v, members, selectedMembers }: Props) {
  const isVideo = v.kind === "video";
  const [tab, setTab] = useState<"meta" | "links" | "file" | "delete">("meta");
  const [tagsInput, setTagsInput] = useState((v.tags ?? []).join(", "));
  const [memberSet, setMemberSet] = useState<Set<string>>(new Set(selectedMembers));

  const linkedMembers = useMemo(
    () => members.filter((m) => memberSet.has(m.id)),
    [members, memberSet],
  );

  const grouped = useMemo(() => {
    const m = new Map<number, DetailMember[]>();
    for (const x of members) {
      if (!m.has(x.gen)) m.set(x.gen, []);
      m.get(x.gen)!.push(x);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [members]);

  const toggleMember = (id: string) => {
    setMemberSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url).then(
      () => toast.success(`Đã copy ${label}`),
      () => toast.error("Không copy được"),
    );
  };

  return (
    <div className="space-y-4">
      <form method="post" className="space-y-4">
        <input type="hidden" name="action" value="save" />
        <input type="hidden" name="id" value={v.id} />

        <Tabs value={tab} onValueChange={(t) => setTab(t as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="meta" className="flex-1 gap-1.5">
              <ScrollText className="size-4" /> Mô tả
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 gap-1.5">
              <Hash className="size-4" /> Liên kết
              {memberSet.size > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {memberSet.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-1.5">
              <FileImage className="size-4" /> File
            </TabsTrigger>
          </TabsList>

          {/* ── Mô tả tab ── */}
          <TabsContent value="meta" className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="caption">Caption (vi) *</Label>
                  <Input
                    id="caption"
                    name="caption"
                    defaultValue={v.caption ?? ""}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="caption_en">Caption (en) *</Label>
                  <Input
                    id="caption_en"
                    name="caption_en"
                    defaultValue={v.caption_en ?? ""}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alt_vi">
                    Alt text (vi)
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      a11y · khuyên có
                    </span>
                  </Label>
                  <Textarea
                    id="alt_vi"
                    name="alt_vi"
                    defaultValue={v.alt_vi ?? ""}
                    placeholder="Mô tả ngắn cho trình đọc màn hình"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alt_en">Alt text (en)</Label>
                  <Textarea
                    id="alt_en"
                    name="alt_en"
                    defaultValue={v.alt_en ?? ""}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Thời gian & địa điểm</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="year" className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> Năm
                  </Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    defaultValue={v.year ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Ngày</Label>
                  <Input
                    id="date"
                    name="date"
                    defaultValue={v.date ?? ""}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="location" className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> Địa điểm
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={v.location ?? ""}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="album">Album / sự kiện</Label>
                  <Input
                    id="album"
                    name="album"
                    defaultValue={v.album ?? ""}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    name="tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="tết, đám-cưới, 2024"
                  />
                  {tagsInput && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tagsInput.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    name="featured"
                    value="1"
                    defaultChecked={v.featured}
                  />
                  Ảnh nổi bật (xếp đầu)
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Liên kết tab ── */}
          <TabsContent value="links" className="space-y-3">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Thành viên trong {isVideo ? "video" : "ảnh"}</CardTitle>
                {linkedMembers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Đã chọn: {linkedMembers.map((m) => m.name).join(", ")}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có thành viên nào.</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {grouped.map(([gen, gms]) => (
                      <div key={gen}>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Đời {gen}
                        </div>
                        {gms.map((m) => (
                          <label
                            key={m.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent text-sm"
                          >
                            <Checkbox
                              name="members"
                              value={m.id}
                              checked={memberSet.has(m.id)}
                              onCheckedChange={() => toggleMember(m.id)}
                            />
                            <span className="flex-1 truncate">{m.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── File info tab ── */}
          <TabsContent value="file" className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Loại</dt>
                  <dd className="text-foreground">{isVideo ? "🎬 Video" : "🖼️ Ảnh"}</dd>

                  <dt className="text-muted-foreground">Kích thước</dt>
                  <dd className="text-foreground">
                    {v.width && v.height ? `${v.width} × ${v.height} px` : "—"}
                  </dd>

                  <dt className="text-muted-foreground">Dung lượng</dt>
                  <dd className="text-foreground">{formatBytes(v.bytes)}</dd>

                  <dt className="text-muted-foreground">Định dạng</dt>
                  <dd className="text-foreground font-mono text-xs">{v.mime ?? "—"}</dd>

                  {isVideo && (
                    <>
                      <dt className="text-muted-foreground">Thời lượng</dt>
                      <dd className="text-foreground tabular-nums">
                        {formatDuration(v.duration_seconds)}
                      </dd>
                      <dt className="text-muted-foreground">Poster</dt>
                      <dd className="text-foreground">
                        {v.src_medium ? "✓ có" : (
                          <span className="text-warning-600">chưa có</span>
                        )}
                      </dd>
                    </>
                  )}
                  {!isVideo && (
                    <>
                      <dt className="text-muted-foreground">EXIF</dt>
                      <dd className="text-foreground">{v.bytes ? "đã xóa" : "—"}</dd>
                      <dt className="text-muted-foreground">Variants</dt>
                      <dd className="text-foreground">
                        {v.src_thumb && v.src_medium ? "✓ thumb + medium" : (
                          <span className="text-warning-600">chỉ có gốc (legacy)</span>
                        )}
                      </dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <LinkIcon className="size-4" /> URL public
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 font-mono text-xs">
                <UrlRow label={isVideo ? "video" : "gốc"} url={v.src} onCopy={onCopy} />
                {v.src_medium && (
                  <UrlRow
                    label={isVideo ? "poster" : "800w"}
                    url={v.src_medium}
                    onCopy={onCopy}
                  />
                )}
                {v.src_thumb && (
                  <UrlRow
                    label={isVideo ? "thumb" : "320w"}
                    url={v.src_thumb}
                    onCopy={onCopy}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" className="w-full" size="lg">
          Lưu thay đổi
        </Button>
      </form>

      {/* Delete card outside the save form so users don't accidentally
          submit-on-Enter into the destructive action. */}
      <Card className="border-error-100 bg-error-50/50">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-error-700">Xóa {isVideo ? "video" : "ảnh"} này</p>
          <p className="text-xs text-error-600">
            Cả file gốc + poster/thumb + tất cả liên kết với thành viên / sự kiện sẽ bị gỡ.
          </p>
          <form
            method="post"
            onSubmit={(e) => {
              if (
                !confirm(
                  `Xóa ${isVideo ? "video" : "ảnh"} này? Hành động không hoàn tác.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="action" value="delete" />
            <Button type="submit" variant="destructive" size="sm" className="w-full">
              Xóa vĩnh viễn
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function UrlRow({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (url: string, label: string) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="break-all flex-1 text-foreground">{url}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 h-6 px-2 text-[10px] font-sans"
        onClick={() => onCopy(url, label)}
      >
        Copy
      </Button>
    </div>
  );
}
