import { supabaseAdmin } from "./supabase/admin";

export type DateRow = {
  id: number;
  date: string;
  calendar: "lunar" | "solar";
  name: string;
  name_en: string;
  type: "memorial" | "festival" | "birthday" | "national" | "anniversary" | "gathering";
  member_id: string | null;
  year: number | null;
  recurring: boolean;
  notes: string | null;
};

export type DateInput = Omit<DateRow, "id"> & { id?: number };

export async function listDates(): Promise<DateRow[]> {
  const { data, error } = await supabaseAdmin
    .from("dates").select("*").order("date", { ascending: true });
  if (error) throw new Error(`listDates: ${error.message}`);
  return (data ?? []) as DateRow[];
}

export async function getDate(id: number): Promise<DateRow | null> {
  const { data, error } = await supabaseAdmin
    .from("dates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getDate: ${error.message}`);
  return (data as DateRow | null) ?? null;
}

export async function deleteDate(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from("dates").delete().eq("id", id);
  if (error) throw new Error(`deleteDate: ${error.message}`);
}

export async function upsertDate(
  input: DateInput, mode: "create" | "update",
): Promise<number> {
  if (mode === "create") {
    const row = { ...input };
    delete (row as Partial<DateInput>).id;
    const { data, error } = await supabaseAdmin
      .from("dates").insert(row).select("id").single();
    if (error) throw new Error(`createDate: ${error.message}`);
    return (data as { id: number }).id;
  } else {
    if (!input.id) throw new Error("missing id for update");
    const { error } = await supabaseAdmin.from("dates").update(input).eq("id", input.id);
    if (error) throw new Error(`updateDate: ${error.message}`);
    return input.id;
  }
}

const CALS = ["lunar", "solar"] as const;
const TYPES = ["memorial", "festival", "birthday", "national", "anniversary", "gathering"] as const;

export function parseDateForm(form: FormData): {
  input: DateInput; errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  if (!get("date")) errors.push("Ngày không được để trống.");
  if (!get("name")) errors.push("Tên (vi) không được để trống.");
  if (!get("name_en")) errors.push("Tên (en) không được để trống.");
  const calendar = get("calendar") as DateRow["calendar"];
  if (!CALS.includes(calendar)) errors.push("Lịch không hợp lệ.");
  const type = get("type") as DateRow["type"];
  if (!TYPES.includes(type)) errors.push("Loại không hợp lệ.");

  const yearRaw = get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && !Number.isInteger(year)) errors.push("Năm phải là số nguyên.");

  return {
    input: {
      date: get("date"),
      calendar,
      name: get("name"),
      name_en: get("name_en"),
      type,
      member_id: getOpt("member_id"),
      year,
      recurring: Boolean(form.get("recurring")),
      notes: getOpt("notes"),
    },
    errors,
  };
}

export const DATE_CALS = CALS;
export const DATE_TYPES = TYPES;
