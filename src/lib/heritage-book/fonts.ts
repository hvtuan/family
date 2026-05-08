import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Register all font variants used by Heritage Book pages. Missing any
 * weight/style combo causes "Could not resolve font for X, fontWeight Y,
 * fontStyle Z" at render time. We register every variant referenced by
 * the page components.
 *
 * URLs come from the Google Fonts CSS API. Bump if Google rev's the
 * directory path (v37/v29/v12 today; check via curl ?subset=vietnamese
 * if you see 404s).
 */
export async function ensureFonts(): Promise<void> {
  if (registered) return;

  Font.register({
    family: "Lora",
    fonts: [
      // 400 normal
      { src: "https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuyJG.ttf", fontWeight: 400 },
      // 600 normal
      { src: "https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787zAvCJG.ttf", fontWeight: 600 },
      // 400 italic
      { src: "https://fonts.gstatic.com/s/lora/v37/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFkqg.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });

  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Eww.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIV8y.ttf", fontWeight: 600 },
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVNSTAyLFyeg_IDWvOJmVES_HwyBX8.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });

  Font.register({
    family: "DancingScript",
    fonts: [
      { src: "https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTQ.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B7y0HTQ.ttf", fontWeight: 600 },
    ],
  });

  registered = true;
}
