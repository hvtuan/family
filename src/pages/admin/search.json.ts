/**
 * GET /admin/search.json — unified payload for the global Cmd+K
 * palette. Returns trimmed lists of every searchable entity in one
 * round-trip so the palette only fetches once per page load.
 *
 * Auth-gated; no-store cache.
 */
import type { APIContext } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export async function GET({ locals }: APIContext): Promise<Response> {
  const user = (locals as { user?: { role: string } }).user;
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Chưa đăng nhập." }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const [
    { data: members },
    { data: photos },
    { data: traditions },
    { data: locations },
    { data: timeline },
    { data: quotes },
  ] = await Promise.all([
    supabaseAdmin.from("members").select("id, name, name_en, gen, role, photo")
      .order("gen", { ascending: true }),
    supabaseAdmin.from("photos").select("id, kind, src, src_thumb, alt_vi, caption, year")
      .order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("traditions").select("id, name, name_en, category, icon, image"),
    supabaseAdmin.from("locations").select("id, name, name_en, province, is_hometown"),
    supabaseAdmin.from("timeline").select("id, title, title_en, year, date, category")
      .order("year", { ascending: false }).limit(100),
    supabaseAdmin.from("quotes").select("id, text_vi, author, type").limit(100),
  ]);

  return new Response(
    JSON.stringify({
      ok: true,
      members: members ?? [],
      photos: photos ?? [],
      traditions: traditions ?? [],
      locations: locations ?? [],
      timeline: timeline ?? [],
      quotes: quotes ?? [],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}
