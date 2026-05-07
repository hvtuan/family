import { supabaseAdmin } from "./supabase/admin";
import { replaceM2M, readM2M } from "./m2m";
import { processImage, extForMime, type ProcessedImage } from "./exif";

const STORAGE_BUCKET = "family-photos";

/** Legacy prefix for /admin/photos uploads (single variant, pre-v2). */
const LEGACY_PHOTOS_PREFIX = "uploads/";

/** Media v2 layout: media/<id>/{original.<ext>, medium.webp, thumb.webp} */
const MEDIA_PREFIX = "media";

const ALLOWED_MIME_LEGACY = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);
const MAX_BYTES_LEGACY = 8 * 1024 * 1024; // 8 MB — kept for non-v2 attachments

// ───────────────────────── media v2: uploadPhotoMedia ──────────────────────

export type UploadedMedia = {
  src: string;
  src_thumb: string | null;
  src_medium: string | null;
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

async function putObject(path: string, body: Buffer | File, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage upload ${path}: ${error.message}`);
  return supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Process + upload an image with all 3 variants under
 * `media/<photoId>/{original.<ext>, medium.webp, thumb.webp}` and
 * return the metadata + URLs the caller writes to the photos row.
 */
export async function uploadPhotoMedia(
  file: File,
  photoId: string,
): Promise<UploadedMedia> {
  const processed: ProcessedImage = await processImage(file);
  const folder = `${MEDIA_PREFIX}/${photoId}`;

  const originalPath = `${folder}/original.${processed.ext}`;
  const mediumPath = `${folder}/medium.webp`;
  const thumbPath = `${folder}/thumb.webp`;

  const originalUrl = await putObject(originalPath, processed.original, processed.mime);

  let mediumUrl: string | null = null;
  let thumbUrl: string | null = null;
  if (processed.medium) {
    mediumUrl = await putObject(mediumPath, processed.medium, "image/webp");
  }
  if (processed.thumb) {
    thumbUrl = await putObject(thumbPath, processed.thumb, "image/webp");
  }

  return {
    src: originalUrl,
    src_thumb: thumbUrl,
    src_medium: mediumUrl,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    mime: processed.mime,
  };
}

/** Replace an existing photo's blobs in-place. Returns new metadata; caller
 *  must update the row's media columns + bump updated_at. */
export async function replacePhotoMedia(
  photoId: string,
  file: File,
): Promise<UploadedMedia> {
  // First clear the folder so that switching ext (jpg → png) doesn't
  // leave stale blobs alongside the new ones.
  await deletePhotoMedia(photoId).catch(() => undefined);
  return uploadPhotoMedia(file, photoId);
}

/** Delete every blob under `media/<photoId>/`. Best-effort. */
export async function deletePhotoMedia(photoId: string): Promise<void> {
  const folder = `${MEDIA_PREFIX}/${photoId}`;
  const { data } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { limit: 100 });
  if (!data || data.length === 0) return;
  const paths = data.map((f) => `${folder}/${f.name}`);
  await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
}

// ───────────────────── legacy uploads (with EXIF strip retrofit) ───────────

/**
 * Legacy single-blob upload to `uploads/<photoId>.<ext>`. Pre-v2 callers
 * still call this; the EXIF strip is now applied transparently so iCloud
 * GPS data doesn't leak even from older code paths.
 */
export async function uploadPhotoFile(
  file: File,
  photoId: string,
): Promise<string> {
  validateLegacy(file);
  const stripped = await stripIfRaster(file);
  const path = `${LEGACY_PHOTOS_PREFIX}${photoId}.${extForMime(stripped.mime)}`;
  return putObject(path, stripped.body, stripped.mime);
}

/**
 * Legacy attachment upload (member avatar, timeline image, tradition
 * image) to `<prefix>/<id>.<ext>`. EXIF stripped transparently.
 */
export async function uploadAttachment(
  file: File,
  prefix: string,
  id: string,
): Promise<string> {
  validateLegacy(file);
  const stripped = await stripIfRaster(file);
  const path = `${prefix}/${id}.${extForMime(stripped.mime)}`;
  return putObject(path, stripped.body, stripped.mime);
}

function validateLegacy(file: File): void {
  if (!ALLOWED_MIME_LEGACY.has(file.type)) {
    throw new Error(`Định dạng không hỗ trợ: ${file.type}. Dùng jpg/png/webp/gif/svg.`);
  }
  if (file.size > MAX_BYTES_LEGACY) {
    throw new Error(`File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn 8 MB.`);
  }
}

/** Run the file through processImage to strip EXIF, but return only the
 *  `original` buffer (single-variant legacy contract). SVG/GIF skip
 *  processing and the raw file is uploaded unchanged. */
async function stripIfRaster(file: File): Promise<{ body: Buffer | File; mime: string }> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { body: file, mime: file.type };
  }
  const processed = await processImage(file);
  return { body: processed.original, mime: processed.mime };
}

/** Delete legacy `uploads/<photoId>.*` blobs (any extension). Best-effort. */
export async function deletePhotoFiles(photoId: string): Promise<void> {
  const { data } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(LEGACY_PHOTOS_PREFIX, { limit: 100, search: photoId });
  if (!data) return;
  const paths = data
    .filter((f) => f.name === photoId || f.name.startsWith(`${photoId}.`))
    .map((f) => `${LEGACY_PHOTOS_PREFIX}${f.name}`);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
  }
}

// ─────────────────────────── photos table CRUD ─────────────────────────────

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
  // media v2 fields (all optional for backward compat)
  src_thumb?: string | null;
  src_medium?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  mime?: string | null;
  alt_vi?: string | null;
  alt_en?: string | null;
  tags?: string[];
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
  // Clean up both the legacy single blob (uploads/<id>.<ext>) AND the
  // media-v2 folder (media/<id>/*). Either may be empty for a given row.
  await Promise.allSettled([
    deletePhotoFiles(id),
    deletePhotoMedia(id),
  ]);
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

  if (!get("caption")) errors.push("Caption (vi) không được để trống.");
  if (!get("caption_en")) errors.push("Caption (en) không được để trống.");

  const yearRaw = get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && !Number.isInteger(year)) errors.push("Năm phải là số nguyên.");

  const memberIds = form.getAll("members").map((v) => String(v)).filter(Boolean);

  // alt + tags optional in legacy form; M2 picker form supplies them.
  const tagsCsv = get("tags");
  const tags = tagsCsv
    ? tagsCsv.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

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
      alt_vi: getOpt("alt_vi"),
      alt_en: getOpt("alt_en"),
      ...(tags ? { tags } : {}),
    },
    memberIds,
    errors,
  };
}
