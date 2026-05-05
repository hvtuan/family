import { supabaseAdmin } from "./supabase/admin";
import { replaceM2M, readM2M } from "./m2m";

export type TimelineRow = {
  id: number;
  year: number;
  date: string | null;
  lunar: boolean;
  title: string;
  title_en: string;
  desc_text: string;
  desc_en: string;
  category: "founding" | "birth" | "marriage" | "death" | "milestone" | "gathering" | null;
  image: string | null;
};

export type TimelineInput = Omit<TimelineRow, "id"> & { id?: number };

export async function listTimeline(): Promise<TimelineRow[]> {
  const { data, error } = await supabaseAdmin
    .from("timeline").select("*").order("year").order("date");
  if (error) throw new Error(`listTimeline: ${error.message}`);
  return (data ?? []) as TimelineRow[];
}

export async function getTimelineEvent(id: number): Promise<TimelineRow | null> {
  const { data, error } = await supabaseAdmin
    .from("timeline").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getTimelineEvent: ${error.message}`);
  return (data as TimelineRow | null) ?? null;
}

export async function getTimelineMembers(id: number): Promise<string[]> {
  return readM2M({
    table: "timeline_members",
    parentCol: "timeline_id",
    childCol: "member_id",
    parentId: id,
  });
}

export async function deleteTimelineEvent(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from("timeline").delete().eq("id", id);
  if (error) throw new Error(`deleteTimelineEvent: ${error.message}`);
}

export async function upsertTimeline(
  input: TimelineInput, memberIds: string[], mode: "create" | "update",
): Promise<number> {
  let id: number;
  if (mode === "create") {
    const row = { ...input };
    delete (row as Partial<TimelineInput>).id;
    const { data, error } = await supabaseAdmin
      .from("timeline").insert(row).select("id").single();
    if (error) throw new Error(`createTimeline: ${error.message}`);
    id = (data as { id: number }).id;
  } else {
    if (!input.id) throw new Error("missing id for update");
    const { error } = await supabaseAdmin
      .from("timeline").update(input).eq("id", input.id);
    if (error) throw new Error(`updateTimeline: ${error.message}`);
    id = input.id;
  }
  await replaceM2M({
    table: "timeline_members",
    parentCol: "timeline_id",
    childCol: "member_id",
    parentId: id,
    childIds: memberIds,
  });
  return id;
}

const CATS = ["founding", "birth", "marriage", "death", "milestone", "gathering"] as const;

export function parseTimelineForm(form: FormData): {
  input: TimelineInput; memberIds: string[]; errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  const yearRaw = Number(get("year"));
  const year = Number.isInteger(yearRaw) ? yearRaw : 0;
  if (!year) errors.push("Năm phải là số nguyên hợp lệ.");
  if (!get("title")) errors.push("Tiêu đề (vi) không được để trống.");
  if (!get("title_en")) errors.push("Tiêu đề (en) không được để trống.");
  if (!get("desc_text")) errors.push("Mô tả (vi) không được để trống.");
  if (!get("desc_en")) errors.push("Mô tả (en) không được để trống.");

  const catRaw = getOpt("category");
  const category =
    catRaw && (CATS as readonly string[]).includes(catRaw)
      ? (catRaw as TimelineRow["category"]) : null;

  const memberIds = form.getAll("members").map((v) => String(v)).filter(Boolean);

  return {
    input: {
      year,
      date: getOpt("date"),
      lunar: Boolean(form.get("lunar")),
      title: get("title"),
      title_en: get("title_en"),
      desc_text: get("desc_text"),
      desc_en: get("desc_en"),
      category,
      image: getOpt("image"),
    },
    memberIds,
    errors,
  };
}

export const TIMELINE_CATS = CATS;
