/**
 * POST /admin/media/upload — multipart, one file at a time so the
 * client can track per-file progress with XHR.
 *
 * Accepts: `file` (binary), optional `id` (slug to use; auto-generated
 * from filename if omitted).
 *
 * Auth: gated by /admin/** middleware. Roles: admin + editor allowed
 * (branch_editor uses the existing per-member upload flow).
 *
 * Side effects: writes 3 variants to Storage and inserts a photos row
 * with minimal metadata (caption derived from filename). Caller
 * navigates to /admin/media/<id> to fill in alt text + tags.
 */
import type { APIContext } from "astro";
import { uploadPhotoMedia } from "@/lib/photos-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;

function slugifyFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")        // strip extension
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "photo";
}

function makeUploadId(filename: string): string {
  const base = slugifyFilename(filename);
  // Compact base36 timestamp keeps total length comfortably under 60.
  const ts = Date.now().toString(36);
  return `${base}-${ts}`;
}

export async function POST({ request, locals }: APIContext): Promise<Response> {
  const user = (locals as { user?: { role: string } }).user;
  if (!user || (user.role !== "admin" && user.role !== "editor" && user.role !== "branch_editor")) {
    return new Response(JSON.stringify({ ok: false, error: "Không có quyền upload." }), {
      status: 403, headers: { "content-type": "application/json" },
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Form không hợp lệ." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "Thiếu file." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const requestedId = String(form.get("id") ?? "").trim().toLowerCase();
  let id = requestedId || makeUploadId(file.name);
  if (!SLUG_RE.test(id)) id = makeUploadId(file.name);

  // Collision guard: append `-2`, `-3`, … until free. Common case is one
  // attempt; only meaningful if user provided their own id and it's
  // already taken or two uploads happen in the same millisecond.
  for (let n = 2; n <= 10; n++) {
    const { data } = await supabaseAdmin.from("photos").select("id").eq("id", id).maybeSingle();
    if (!data) break;
    id = `${id}-${n}`;
    if (!SLUG_RE.test(id)) {
      return new Response(JSON.stringify({ ok: false, error: "ID đã tồn tại, hãy đổi tên file." }), {
        status: 409, headers: { "content-type": "application/json" },
      });
    }
  }

  // Optional poster file (browser extracted a frame from a <video> for us).
  // Only meaningful when `file` is a video; ignored otherwise.
  const posterRaw = form.get("poster");
  const posterFile = posterRaw instanceof File && posterRaw.size > 0 ? posterRaw : null;

  // Optional duration in seconds, derived client-side from the <video>
  // element's `duration` property.
  const durationRaw = String(form.get("duration_seconds") ?? "").trim();
  const durationSeconds = durationRaw && !Number.isNaN(Number(durationRaw))
    ? Math.round(Number(durationRaw))
    : null;

  let media;
  try {
    media = await uploadPhotoMedia(file, id, { posterFile, durationSeconds });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Upload thất bại." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // Default caption from filename (without ext). Admin can edit later.
  const captionDefault = file.name.replace(/\.[^.]+$/, "").trim() || id;

  const { error: insErr } = await supabaseAdmin.from("photos").insert({
    id,
    kind: media.kind,
    src: media.src,
    src_thumb: media.src_thumb,
    src_medium: media.src_medium,
    width: media.width,
    height: media.height,
    bytes: media.bytes,
    mime: media.mime,
    duration_seconds: media.duration_seconds ?? null,
    caption: captionDefault,
    caption_en: captionDefault,
    featured: false,
  });

  if (insErr) {
    return new Response(
      JSON.stringify({ ok: false, error: `DB insert: ${insErr.message}` }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      id,
      kind: media.kind,
      src: media.src,
      src_thumb: media.src_thumb,
      src_medium: media.src_medium,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
      duration_seconds: media.duration_seconds ?? null,
      editUrl: `/admin/media/${id}`,
    }),
    { status: 201, headers: { "content-type": "application/json" } },
  );
}
