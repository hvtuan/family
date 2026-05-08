/**
 * GET /admin/heritage-book.pdf
 *
 * Streams a generated PDF book based on query options:
 *   ?include_drafts=true|false (default false)
 *   ?include_album=true|false (default true)
 *   ?include_traditions=true|false (default true)
 *   ?lang=vi|en (default vi)
 *
 * Auth: admin or branch_editor only.
 */
import type { APIRoute } from "astro";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { ensureFonts } from "@/lib/heritage-book/fonts";
import { buildBookData } from "@/lib/heritage-book/data";
import { HeritageBook } from "@/lib/heritage-book";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const me = locals.user;
  if (!me || (me.role !== "admin" && me.role !== "branch_editor")) {
    return new Response("Forbidden", { status: 403 });
  }

  let stage = "init";
  try {
    stage = "ensureFonts";
    await ensureFonts();

    stage = "parseOptions";
    const includeDrafts = url.searchParams.get("include_drafts") === "true";
    const includeAlbum = url.searchParams.get("include_album") !== "false";
    const includeTraditions = url.searchParams.get("include_traditions") !== "false";
    const lang = (url.searchParams.get("lang") === "en" ? "en" : "vi") as "vi" | "en";

    stage = "buildBookData";
    const data = await buildBookData({
      includeDrafts,
      includePhotos: includeAlbum,
      includeTraditions,
      includeAlbum,
      lang,
    });

    stage = "renderToStream";
    const stream = await renderToStream(
      React.createElement(HeritageBook, { data }) as React.ReactElement<DocumentProps>,
    );

    stage = "stream-bridge";
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => {
          console.error("[heritage-book.pdf] stream error:", err);
          controller.error(err);
        });
      },
    });

    const filename = `gia-pha-ho-${data.surname.toLowerCase()}-${data.publicationYear}.pdf`;
    return new Response(webStream, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error
      ? `${err.name}: ${err.message}\n${err.stack ?? ""}`
      : String(err);
    console.error(`[heritage-book.pdf] failed at stage="${stage}":`, detail);
    return new Response(
      `Heritage Book PDF render failed at stage "${stage}".\n\n${detail}`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }
};
