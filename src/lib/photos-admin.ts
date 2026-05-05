import { supabaseAdmin } from "./supabase/admin";
import { replaceM2M, readM2M } from "./m2m";

const STORAGE_BUCKET = "family-photos";
/** Files uploaded via the admin form land in this prefix. The seed
 *  migration script uses `seed/` for its own assets so the two don't
 *  step on each other. */
const STORAGE_PREFIX = "uploads/";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  // Fall back to mime → ext
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "image/svg+xml": "svg",
  };
  return map[file.type] ?? "bin";
}

/** Upload a file to family-photos/uploads/<photoId>.<ext>, overwrite on
 *  edit. Returns the public URL the row's `src` column should hold. */
export async function uploadPhotoFile(
  file: File,
  photoId: string,
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Định dạng không hỗ trợ: ${file.type}. Dùng jpg/png/webp/gif/svg.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn 8 MB.`);
  }
  const path = `${STORAGE_PREFIX}${photoId}.${extFromFile(file)}`;
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
  if (error) throw new Error(`uploadPhotoFile: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload an attachment for a non-photos record (member avatar,
 *  timeline event image, tradition image, etc.) into
 *  family-photos/<prefix>/<id>.<ext>. Returns the public URL.
 *
 *  Different prefix from `uploads/` (which is for /admin/photos rows)
 *  so a member with id="g3-1" doesn't collide with a photos row with
 *  id="g3-1". */
export async function uploadAttachment(
  file: File,
  prefix: string,
  id: string,
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Định dạng không hỗ trợ: ${file.type}.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn 8 MB.`);
  }
  const path = `${prefix}/${id}.${extFromFile(file)}`;
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
  if (error) throw new Error(`uploadAttachment: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Delete every uploaded variant of a photo id (different extensions
 *  may exist if the admin re-uploaded with a different format).
 *  Best-effort — orphans don't break anything. */
export async function deletePhotoFiles(photoId: string): Promise<void> {
  const { data } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(STORAGE_PREFIX, { limit: 100, search: photoId });
  if (!data) return;
  const paths = data
    .filter((f) => f.name === photoId || f.name.startsWith(`${photoId}.`))
    .map((f) => `${STORAGE_PREFIX}${f.name}`);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
  }
}

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

/** Photos already linked to this member, newest first. */
export async function listPhotosForMember(memberId: string): Promise<PhotoRow[]> {
  const { data: links, error: e1 } = await supabaseAdmin
    .from("photo_members")
    .select("photo_id")
    .eq("member_id", memberId);
  if (e1) throw new Error(`listPhotosForMember links: ${e1.message}`);
  const ids = ((links ?? []) as { photo_id: string }[]).map((l) => l.photo_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("photos")
    .select("*")
    .in("id", ids)
    .order("featured", { ascending: false })
    .order("year", { ascending: false });
  if (error) throw new Error(`listPhotosForMember: ${error.message}`);
  return (data ?? []) as PhotoRow[];
}

/** Existing photos that this member is *not* linked to yet, for the
 *  "link existing" picker. Filtered client-side because the dataset is
 *  small and `not in (…)` syntax is awkward in supabase-js. */
export async function listPhotosNotLinkedTo(memberId: string): Promise<PhotoRow[]> {
  const [all, linked] = await Promise.all([
    listPhotos(),
    listPhotosForMember(memberId),
  ]);
  const linkedIds = new Set(linked.map((p) => p.id));
  return all.filter((p) => !linkedIds.has(p.id));
}

export async function linkPhotoToMember(
  photoId: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("photo_members")
    .insert({ photo_id: photoId, member_id: memberId });
  // Composite-PK race: another concurrent click is fine, swallow.
  if (error && !error.message.includes("duplicate") && !error.message.includes("23505")) {
    throw new Error(`linkPhotoToMember: ${error.message}`);
  }
}

export async function unlinkPhotoFromMember(
  photoId: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("photo_members")
    .delete()
    .eq("photo_id", photoId)
    .eq("member_id", memberId);
  if (error) throw new Error(`unlinkPhotoFromMember: ${error.message}`);
}

export async function deletePhoto(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("photos").delete().eq("id", id);
  if (error) throw new Error(`deletePhoto: ${error.message}`);
  // Best-effort cleanup of the uploaded file. Errors are swallowed
  // because the row is already gone and the storage object is just bytes.
  await deletePhotoFiles(id).catch((e) =>
    console.error(`[photos] file cleanup failed for ${id}:`, e),
  );
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

  // src is optional here because an uploaded file (handled by the page
  // handler, not this parser) may set src after upload. The page-level
  // validation rejects the case where both are empty.
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
