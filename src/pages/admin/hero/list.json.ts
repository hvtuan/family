import type { APIContext } from "astro";
import { listHeroSlides } from "@/lib/hero-admin";

export const prerender = false;

export async function GET({ locals }: APIContext): Promise<Response> {
  const user = (locals as { user?: { role: string } }).user;
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Chưa đăng nhập." }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  const slides = await listHeroSlides(true);
  return new Response(JSON.stringify({ ok: true, slides }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
