/**
 * Photo actions for one member, posted from MemberPhotos.astro on the
 * member edit page.
 *
 *   action=upload  → file + caption + (caption_en, year, id slug).
 *                    Uploads to Storage, inserts a family.photos row,
 *                    and links it to this member via photo_members.
 *   action=link    → form.getAll("photo_id") → bulk insert into
 *                    photo_members.
 *   action=unlink  → single photo_id, removes the photo_members row.
 *                    The photo itself stays in /admin/photos.
 *
 * After each action redirects back to /admin/members/[id]?ok=… or ?err=…
 * so the dashed-banner pattern on the member page stays the only UI.
 */

import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  uploadPhotoFile,
  linkPhotoToMember,
  unlinkPhotoFromMember,
} from "@/lib/photos-admin";

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const memberId = params.id;
  if (!memberId) return new Response("missing id", { status: 400 });
  if (!locals.user) return redirect("/admin/login");

  const back = (suffix: string) =>
    redirect(`/admin/members/${memberId}${suffix}`);
  const fail = (msg: string) =>
    back(`?err=${encodeURIComponent(msg)}`);

  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  try {
    if (action === "upload") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return fail("Cần chọn file ảnh.");
      }
      const id = String(form.get("id") ?? "").trim().toLowerCase();
      if (!SLUG_RE.test(id)) {
        return fail("ID ảnh phải là chữ thường + số + . _ -");
      }
      const caption = String(form.get("caption") ?? "").trim();
      if (!caption) return fail("Caption (vi) không được để trống.");
      const captionEn = String(form.get("caption_en") ?? "").trim() || caption;
      const yearRaw = String(form.get("year") ?? "").trim();
      const year = yearRaw ? Number(yearRaw) : null;
      if (year !== null && !Number.isInteger(year)) {
        return fail("Năm phải là số nguyên.");
      }

      const url = await uploadPhotoFile(file, id);
      const { error } = await supabaseAdmin.from("photos").insert({
        id,
        src: url,
        caption,
        caption_en: captionEn,
        year,
        date: null,
        location: null,
        album: null,
        featured: false,
      });
      if (error) {
        // Most likely a duplicate id. We've already uploaded the file —
        // overwrite is fine because uploadPhotoFile is upsert; just surface.
        if (error.message.includes("duplicate") || error.message.includes("23505")) {
          return fail(`ID "${id}" đã tồn tại — chọn ID khác.`);
        }
        throw error;
      }
      await linkPhotoToMember(id, memberId);
      return back("?ok=photo_uploaded");
    }

    if (action === "link") {
      const photoIds = form
        .getAll("photo_id")
        .map((v) => String(v))
        .filter(Boolean);
      if (photoIds.length === 0) return fail("Chưa chọn ảnh nào.");
      for (const pid of photoIds) {
        await linkPhotoToMember(pid, memberId);
      }
      return back(`?ok=photo_linked_${photoIds.length}`);
    }

    if (action === "unlink") {
      const photoId = String(form.get("photo_id") ?? "").trim();
      if (!photoId) return fail("Thiếu photo_id.");
      await unlinkPhotoFromMember(photoId, memberId);
      return back("?ok=photo_unlinked");
    }

    return fail(`Hành động không hợp lệ: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return fail(msg);
  }
};
