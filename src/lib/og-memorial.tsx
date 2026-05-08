/**
 * Memorial OG image renderer (Satori + resvg).
 *
 * 1200×630 PNG: paper-warm background + sepia portrait + Lora name +
 * dual-calendar dates + lotus seal with Quốc ngữ surname. Zero Hán per D24.
 *
 * Tone matches feedback memory `family_memorial_tone`: warm, modern,
 * NOT gothic. No smoke, no candles, no Chinese characters.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import React from "react";
import { loadOgFonts } from "./og-fonts";
import type { MemorialMember } from "./memorial";
import { formatLunarVi } from "./lunar";
import type { Locale } from "@/i18n";

const WIDTH = 1200;
const HEIGHT = 630;

export type RenderInput = {
  member: MemorialMember;
  surname: string;
  lang: Locale;
  publicUrl: string;
};

export async function renderMemorialOg(input: RenderInput): Promise<Buffer> {
  const fonts = await loadOgFonts();
  const photoSrc = await resolvePhotoForOg(input.member.photoUrl, input.publicUrl);

  const svg = await satori(buildMarkup({ ...input, photoSrc }), {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    background: "#FAF6EC",
  });
  return resvg.render().asPng();
}

interface MarkupProps extends RenderInput {
  photoSrc: string | null;
}

function buildMarkup(p: MarkupProps): React.ReactElement {
  const { member, surname, lang, photoSrc } = p;
  const bornY = member.born ? new Date(member.born).getFullYear().toString() : null;
  const diedY = member.died ? new Date(member.died).getFullYear().toString() : "";
  const dateRange = bornY && diedY ? `${bornY} – ${diedY}` : `– ${diedY}`;
  const lunarLabel = formatLunarVi(member.deathDateLunar);

  const kicker = lang === "en" ? "In Memoriam" : "Tưởng niệm";
  const sealText = `Họ ${surname}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAF6EC",
        backgroundImage:
          "radial-gradient(ellipse at top left, rgba(214, 160, 80, 0.10) 0%, transparent 50%)",
        padding: "60px",
        fontFamily: "BeVietnamPro",
      }}
    >
      {/* Portrait column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "380px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "320px",
            height: "400px",
            border: "2px solid rgba(214, 160, 80, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFF8E8",
            overflow: "hidden",
            boxShadow: "0 10px 40px -20px rgba(120, 80, 40, 0.4)",
          }}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              width={320}
              height={400}
              style={{ objectFit: "cover", filter: "sepia(0.18) saturate(0.9)" }}
            />
          ) : (
            <div
              style={{
                fontSize: "100px",
                color: "rgba(214, 160, 80, 0.35)",
                fontFamily: "Lora",
                fontStyle: "italic",
              }}
            >
              {member.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>

      {/* Text column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          paddingLeft: "60px",
          color: "#3A2E1A",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            color: "#9C8A6A",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: "20px",
          }}
        >
          {kicker}
        </div>

        <div
          style={{
            fontSize: "76px",
            fontFamily: "Lora",
            fontStyle: "italic",
            fontWeight: 600,
            lineHeight: 1.05,
            marginBottom: "18px",
          }}
        >
          {member.name}
        </div>

        <div
          style={{
            fontSize: "26px",
            color: "#5A4A30",
            fontFamily: "BeVietnamPro",
            letterSpacing: "0.05em",
            marginBottom: "8px",
          }}
        >
          {dateRange}
        </div>

        <div
          style={{
            fontSize: "20px",
            color: "#9C8A6A",
            fontFamily: "Lora",
            fontStyle: "italic",
            marginBottom: "30px",
          }}
        >
          {lunarLabel}
        </div>

        {/* Soft accent line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "30px",
          }}
        >
          <div style={{ height: "2px", width: "80px", backgroundColor: "rgba(214, 160, 80, 0.5)" }} />
          <div style={{ fontSize: "22px", color: "#D6A050" }}>🌸</div>
          <div style={{ height: "2px", width: "80px", backgroundColor: "rgba(214, 160, 80, 0.5)" }} />
        </div>

        {/* Lotus seal: text only — Satori doesn't render emoji as Lotus */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontFamily: "DancingScript",
              fontSize: "44px",
              color: "#D6A050",
              lineHeight: 1,
            }}
          >
            {sealText}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#9C8A6A",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginTop: "6px",
            }}
          >
            family.huynhvantuan.net
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Satori needs an absolute URL or a data: URI to embed an <img>.
 * If the photo URL is relative, prefix the public site origin.
 */
async function resolvePhotoForOg(
  photoUrl: string | null,
  publicUrl: string
): Promise<string | null> {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("data:")) return photoUrl;
  if (/^https?:\/\//.test(photoUrl)) {
    // Satori requires the body of the response, not a URL. Fetch + base64.
    try {
      const res = await fetch(photoUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }
  // Relative path — prefix public URL and recurse to fetch.
  return resolvePhotoForOg(`${publicUrl.replace(/\/$/, "")}${photoUrl}`, publicUrl);
}
