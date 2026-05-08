/**
 * GET /og/memorial/[id].png — dynamic OG image for memorial pages.
 *
 * Cached by Cloudflare for 24h via cache-control headers; first render
 * is ~600-1000ms cold (font fetch + photo fetch), <100ms warm worker
 * memory hit thereafter.
 */
import type { APIRoute } from "astro";
import { getMemorialMember } from "@/lib/memorial";
import { getLocale } from "@/i18n";
import { getSetting } from "@/lib/settings";
import { renderMemorialOg } from "@/lib/og-memorial";

export const prerender = false;

export const GET: APIRoute = async ({ params, url, cookies }) => {
  const id = params.id;
  if (!id) return new Response("Bad request", { status: 400 });

  const member = await getMemorialMember(id);
  if (!member) return new Response("Not found", { status: 404 });

  const lang = getLocale({ url, cookies });
  const publicUrl =
    (await getSetting("site.public_url")) ?? "https://family.huynhvantuan.net";
  const surname = (await getSetting("site.surname")) ?? "Nguyễn";

  try {
    const png = await renderMemorialOg({ member, surname, lang, publicUrl });
    const body = new Uint8Array(png).buffer;
    return new Response(body as ArrayBuffer, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[og/memorial] render failed:", err);
    return new Response("Render failed", { status: 500 });
  }
};
