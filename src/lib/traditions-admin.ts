import { supabaseAdmin } from "./supabase/admin";
import { parseCsv } from "./members-admin";

export type TraditionRow = {
  id: string;
  name: string;
  name_en: string;
  category: "food" | "festival" | "ceremony" | "craft";
  icon: "bowl" | "fish" | "leaf" | "shell" | "incense" | "blossom";
  desc_text: string;
  desc_en: string;
  origin: string | null;
  image: string | null;
  body_md: string | null;
  tags: string[];
};

export async function listTraditions(): Promise<TraditionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("traditions")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`listTraditions: ${error.message}`);
  return (data ?? []) as TraditionRow[];
}

export async function getTradition(id: string): Promise<TraditionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("traditions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getTradition: ${error.message}`);
  return (data as TraditionRow | null) ?? null;
}

export async function deleteTradition(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("traditions").delete().eq("id", id);
  if (error) throw new Error(`deleteTradition: ${error.message}`);
}

export async function upsertTradition(
  input: TraditionRow,
  mode: "create" | "update",
): Promise<void> {
  if (mode === "create") {
    const { error } = await supabaseAdmin.from("traditions").insert(input);
    if (error) throw new Error(`createTradition: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin
      .from("traditions").update(input).eq("id", input.id);
    if (error) throw new Error(`updateTradition: ${error.message}`);
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;
const CATS = ["food", "festival", "ceremony", "craft"] as const;
const ICONS = ["bowl", "fish", "leaf", "shell", "incense", "blossom"] as const;

export function parseTraditionForm(form: FormData): {
  input: TraditionRow;
  errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  const id = get("id").toLowerCase();
  if (!SLUG_RE.test(id)) errors.push("ID phải là chữ thường + số + gạch ngang.");
  if (!get("name")) errors.push("Tên (vi) không được để trống.");
  if (!get("name_en")) errors.push("Tên (en) không được để trống.");
  if (!get("desc_text")) errors.push("Mô tả (vi) không được để trống.");
  if (!get("desc_en")) errors.push("Mô tả (en) không được để trống.");

  const category = get("category") as TraditionRow["category"];
  if (!CATS.includes(category)) errors.push("Danh mục không hợp lệ.");
  const icon = get("icon") as TraditionRow["icon"];
  if (!ICONS.includes(icon)) errors.push("Icon không hợp lệ.");

  return {
    input: {
      id,
      name: get("name"),
      name_en: get("name_en"),
      category,
      icon,
      desc_text: get("desc_text"),
      desc_en: get("desc_en"),
      origin: getOpt("origin"),
      image: getOpt("image"),
      body_md: getOpt("body_md"),
      tags: parseCsv(get("tags")),
    },
    errors,
  };
}

export const TRADITION_CATS = CATS;
export const TRADITION_ICONS = ICONS;
