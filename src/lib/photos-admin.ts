import { supabaseAdmin } from "./supabase/admin";
import { replaceM2M, readM2M } from "./m2m";

export type PhotoRow = {
  id: string;
  src: string;
  caption: string;
  caption_en: string;
  year: number | null;
  date: string | null;
  location: string | null;
  album: string | null;
  featured: boolean;
};

export async function listPhotos(): Promise<PhotoRow[]> {
  const { data, error } = await supabaseAdmin
    .from("photos").select("*")
    .order("featured", { ascending: false })
    .order("year", { ascending: false });
  if (error) throw new Error(`listPhotos: ${error.message}`);
  return (data ?? []) as PhotoRow[];
}

export async function getPhoto(id: string): Promise<PhotoRow | null> {
  const { data, error } = await supabaseAdmin
    .from("photos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getPhoto: ${error.message}`);
  return (data as PhotoRow | null) ?? null;
}

export async function getPhotoMembers(id: string): Promise<string[]> {
  return readM2M({
    table: "photo_members",
    parentCol: "photo_id",
    childCol: "member_id",
    parentId: id,
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("photos").delete().eq("id", id);
  if (error) throw new Error(`deletePhoto: ${error.message}`);
}

export async function upsertPhoto(
  input: PhotoRow, memberIds: string[], mode: "create" | "update",
): Promise<void> {
  if (mode === "create") {
    const { error } = await supabaseAdmin.from("photos").insert(input);
    if (error) throw new Error(`createPhoto: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin.from("photos").update(input).eq("id", input.id);
    if (error) throw new Error(`updatePhoto: ${error.message}`);
  }
  await replaceM2M({
    table: "photo_members",
    parentCol: "photo_id",
    childCol: "member_id",
    parentId: input.id,
    childIds: memberIds,
  });
}

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;

export function parsePhotoForm(form: FormData): {
  input: PhotoRow; memberIds: string[]; errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  const id = get("id").toLowerCase();
  if (!SLUG_RE.test(id)) errors.push("ID phải là chữ thường + số + . _ -");
  if (!get("src")) errors.push("URL ảnh không được để trống.");
  if (!get("caption")) errors.push("Caption (vi) không được để trống.");
  if (!get("caption_en")) errors.push("Caption (en) không được để trống.");

  const yearRaw = get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && !Number.isInteger(year)) errors.push("Năm phải là số nguyên.");

  const memberIds = form.getAll("members").map((v) => String(v)).filter(Boolean);

  return {
    input: {
      id,
      src: get("src"),
      caption: get("caption"),
      caption_en: get("caption_en"),
      year,
      date: getOpt("date"),
      location: getOpt("location"),
      album: getOpt("album"),
      featured: Boolean(form.get("featured")),
    },
    memberIds,
    errors,
  };
}
