import { supabaseAdmin } from "./supabase/admin";

export type QuoteRow = {
  id: number;
  text_vi: string;
  text_en: string | null;
  author: string;
  author_ref: string | null;
  type: "proverb" | "family" | "poem" | "letter";
  context: string | null;
};

export type QuoteInput = Omit<QuoteRow, "id"> & { id?: number };

export async function listQuotes(): Promise<QuoteRow[]> {
  const { data, error } = await supabaseAdmin
    .from("quotes").select("*").order("id", { ascending: true });
  if (error) throw new Error(`listQuotes: ${error.message}`);
  return (data ?? []) as QuoteRow[];
}

export async function getQuote(id: number): Promise<QuoteRow | null> {
  const { data, error } = await supabaseAdmin
    .from("quotes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getQuote: ${error.message}`);
  return (data as QuoteRow | null) ?? null;
}

export async function deleteQuote(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from("quotes").delete().eq("id", id);
  if (error) throw new Error(`deleteQuote: ${error.message}`);
}

export async function upsertQuote(
  input: QuoteInput,
  mode: "create" | "update",
): Promise<number> {
  if (mode === "create") {
    const row = { ...input };
    delete (row as Partial<QuoteInput>).id;
    const { data, error } = await supabaseAdmin
      .from("quotes").insert(row).select("id").single();
    if (error) throw new Error(`createQuote: ${error.message}`);
    return (data as { id: number }).id;
  } else {
    if (!input.id) throw new Error("missing id for update");
    const { error } = await supabaseAdmin
      .from("quotes").update(input).eq("id", input.id);
    if (error) throw new Error(`updateQuote: ${error.message}`);
    return input.id;
  }
}

const TYPES = ["proverb", "family", "poem", "letter"] as const;

export function parseQuoteForm(form: FormData): {
  input: QuoteInput;
  errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  if (!get("text_vi")) errors.push("Nội dung (vi) không được để trống.");
  if (!get("author")) errors.push("Tác giả không được để trống.");
  const type = get("type") as QuoteRow["type"];
  if (!TYPES.includes(type)) errors.push("Loại không hợp lệ.");

  return {
    input: {
      text_vi: get("text_vi"),
      text_en: getOpt("text_en"),
      author: get("author"),
      author_ref: getOpt("author_ref"),
      type,
      context: getOpt("context"),
    },
    errors,
  };
}

export const QUOTE_TYPES = TYPES;
