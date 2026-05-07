/**
 * GET /admin/media/list.json — returns the photo library as a flat
 * array for the MediaPicker modal. Auth-gated (admin/editor/branch_editor).
 *
 * Response shape (lite — picker doesn't need every column):
 *   { photos: [{ id, src, src_thumb, alt_vi, caption, year, tags }] }
 *
 * Sorted: featured first, then most-recent year, then id.
 */
import type { APIContext } from "astro";
import { listPhotos } from "@/lib/photos-admin";

export const prerender = false;

export async function GET({ locals }: APIContext): Promise<Response> {
  const user = (locals as { user?: { role: string } }).user;
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Chưa đăng nhập." }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const all = await listPhotos();
  const photos = all.map((p) => ({
    id: p.id,
    src: p.src,
    src_thumb: p.src_thumb ?? null,
    alt_vi: p.alt_vi ?? null,
    caption: p.caption,
    year: p.year,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));

  return new Response(JSON.stringify({ ok: true, photos }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
