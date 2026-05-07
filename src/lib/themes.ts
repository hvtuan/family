/**
 * Admin-managed visual themes.
 *
 * A theme = an id + label + a JSONB of CSS variable overrides applied
 * via [data-theme="X"] on <html>. The default theme (is_default=true)
 * is what every public page renders with — no client-side picker.
 *
 * generateThemeCss() turns a list of theme rows into a single <style>
 * block injected into the <head> so the browser already has every
 * theme's overrides ready before paint.
 */
import { supabaseAdmin } from "./supabase/admin";

export type ThemeVars = Record<string, string>;

export type ThemeRow = {
  id: string;
  label_vi: string;
  label_en: string;
  swatch: string;
  vars: ThemeVars;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** All settable variable keys. The admin form lists them in this
 *  order, grouped visually on the screen. */
export const THEME_VAR_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Văn bản",
    keys: ["color-ink", "color-ink-2", "color-ink-3"],
  },
  {
    label: "Nền giấy",
    keys: ["color-paper", "color-paper-2", "color-paper-3", "color-cream"],
  },
  {
    label: "Vàng (accent)",
    keys: ["color-gold", "color-gold-2", "color-gold-3"],
  },
  {
    label: "Son đỏ (primary)",
    keys: ["color-vermilion", "color-vermilion-2"],
  },
  {
    label: "Ngọc bích (secondary)",
    keys: ["color-jade", "color-jade-2"],
  },
  {
    label: "Đường viền",
    keys: ["color-line", "color-line-strong"],
  },
];

export const ALL_THEME_KEYS: string[] = THEME_VAR_GROUPS.flatMap((g) => g.keys);

export async function listThemes(): Promise<ThemeRow[]> {
  const { data, error } = await supabaseAdmin
    .from("themes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label_vi", { ascending: true });
  if (error) throw new Error(`listThemes: ${error.message}`);
  return (data ?? []) as ThemeRow[];
}

export async function getThemeById(id: string): Promise<ThemeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("themes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getThemeById ${id}: ${error.message}`);
  return (data as ThemeRow | null) ?? null;
}

export async function getDefaultTheme(): Promise<ThemeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("themes")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw new Error(`getDefaultTheme: ${error.message}`);
  return (data as ThemeRow | null) ?? null;
}

export type CreateThemeInput = {
  id: string;
  label_vi: string;
  label_en: string;
  swatch: string;
  vars: ThemeVars;
  sort_order?: number;
};

export async function createTheme(input: CreateThemeInput): Promise<ThemeRow> {
  const { data, error } = await supabaseAdmin
    .from("themes")
    .insert({
      id: input.id,
      label_vi: input.label_vi,
      label_en: input.label_en,
      swatch: input.swatch,
      vars: input.vars,
      is_default: false,
      sort_order: input.sort_order ?? 100,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createTheme: ${error.message}`);
  return data as ThemeRow;
}

export type UpdateThemeInput = Partial<{
  label_vi: string;
  label_en: string;
  swatch: string;
  vars: ThemeVars;
  sort_order: number;
}>;

export async function updateTheme(id: string, patch: UpdateThemeInput): Promise<void> {
  const { error } = await supabaseAdmin
    .from("themes")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(`updateTheme ${id}: ${error.message}`);
}

export async function deleteTheme(id: string): Promise<void> {
  // The DB partial unique index prevents deleting the default — but
  // surface a friendlier error if attempted.
  const cur = await getThemeById(id);
  if (!cur) return;
  if (cur.is_default) {
    throw new Error("Không xóa được theme đang đặt làm mặc định. Đổi default sang theme khác trước.");
  }
  const { error } = await supabaseAdmin
    .from("themes")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteTheme ${id}: ${error.message}`);
}

export async function setDefaultTheme(id: string): Promise<void> {
  // Two-step: clear current default → set new default. Wrap so even on
  // the rare case of a partial failure we don't end up with zero
  // defaults (the upsert here covers the gap).
  const target = await getThemeById(id);
  if (!target) throw new Error(`Theme not found: ${id}`);
  const { error: e1 } = await supabaseAdmin
    .from("themes")
    .update({ is_default: false })
    .eq("is_default", true);
  if (e1) throw new Error(`setDefaultTheme clear: ${e1.message}`);
  const { error: e2 } = await supabaseAdmin
    .from("themes")
    .update({ is_default: true })
    .eq("id", id);
  if (e2) throw new Error(`setDefaultTheme set: ${e2.message}`);
}

/**
 * Generate the <style> tag content with one rule per theme. The
 * default theme also writes to :root so the page paints correctly
 * even before the inline data-theme script runs.
 */
export function generateThemeCss(themes: ThemeRow[]): string {
  if (themes.length === 0) return "";
  const lines: string[] = [];
  for (const t of themes) {
    const decls = Object.entries(t.vars)
      .map(([k, v]) => `--${k}: ${v};`)
      .join(" ");
    lines.push(`[data-theme="${t.id}"] { ${decls} }`);
    if (t.is_default) {
      // Mirror onto :root so paint matches even before JS runs (the
      // inline script will set [data-theme] in a tick anyway, but this
      // avoids a flash on the very first frame).
      lines.push(`:root { ${decls} }`);
    }
  }
  return lines.join("\n");
}
