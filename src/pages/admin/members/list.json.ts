/**
 * GET /admin/members/list.json — lite member list for the global Cmd+K
 * palette and any future picker. Auth-gated, no-store.
 */
import type { APIContext } from "astro";
import { listMembers } from "@/lib/members-admin";

export const prerender = false;

export async function GET({ locals }: APIContext): Promise<Response> {
  const user = (locals as { user?: { role: string } }).user;
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Chưa đăng nhập." }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const rows = await listMembers();
  const members = rows.map((m) => ({
    id: m.id,
    name: m.name,
    name_en: m.name_en ?? null,
    gen: m.gen,
    role: m.role,
    photo: m.photo ?? null,
  }));
  return new Response(JSON.stringify({ ok: true, members }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
