/**
 * Lazy font loader for Satori OG rendering.
 *
 * Pulls Vietnamese-subset font files from Google Fonts at first request
 * and caches them in module memory for the lifetime of the SSR worker
 * (Astro Node `mode: 'standalone'` keeps a long-lived process).
 *
 * Why Google Fonts on-the-fly: smaller repo, no font binaries committed.
 * Trade-off: first request is slower (~300ms warm-up); CDN cache on the
 * resulting PNG (24h) absorbs that easily.
 *
 * Three families:
 *   - Lora (serif body)
 *   - Be Vietnam Pro (sans body)
 *   - Dancing Script (script — Quốc ngữ calligraphy for the seal)
 */
type FontWeight = 400 | 500 | 600 | 700;

export type SatoriFont = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal" | "italic";
};

interface FontSpec {
  family: string;
  url: string;
  weight: FontWeight;
  style?: "normal" | "italic";
}

// Google Fonts API direct font-file URLs. The `subset=vietnamese` query
// is reflected in the file path Google chooses; these are the actual
// .ttf files for the Vietnamese subset of each family at the listed weight.
//
// To regenerate if Google changes paths:
//   curl -A "Mozilla/5.0" 'https://fonts.googleapis.com/css2?family=Lora:wght@600&subset=vietnamese' | grep src
const FONT_SPECS: FontSpec[] = [
  {
    family: "Lora",
    weight: 600,
    url: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkqg.ttf",
  },
  {
    family: "Lora",
    weight: 400,
    style: "italic",
    url: "https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMw_HLD0iyOxZ4FWEPNB6peM.ttf",
  },
  {
    family: "BeVietnamPro",
    weight: 400,
    url: "https://fonts.gstatic.com/s/bevietnampro/v11/QdVPSTAyLFyeg_IDWvOJmVES_HRUBX8YYbAjbHaXE2QyOL5W.ttf",
  },
  {
    family: "BeVietnamPro",
    weight: 600,
    url: "https://fonts.gstatic.com/s/bevietnampro/v11/QdVPSTAyLFyeg_IDWvOJmVES_HRUBX8YxbsjbHaXE2QyOL5W.ttf",
  },
  {
    family: "DancingScript",
    weight: 600,
    url: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_swLvBtskOXTqNcgWor1faisXX0c.ttf",
  },
];

let cache: SatoriFont[] | null = null;
let pending: Promise<SatoriFont[]> | null = null;

export async function loadOgFonts(): Promise<SatoriFont[]> {
  if (cache) return cache;
  if (pending) return pending;

  pending = (async () => {
    const fetched = await Promise.all(
      FONT_SPECS.map(async (spec) => {
        const res = await fetch(spec.url);
        if (!res.ok) {
          throw new Error(`og-fonts: ${spec.family} ${spec.weight} fetch failed (${res.status})`);
        }
        const data = await res.arrayBuffer();
        return {
          name: spec.family,
          data,
          weight: spec.weight,
          style: spec.style ?? "normal",
        } as SatoriFont;
      })
    );
    cache = fetched;
    pending = null;
    return fetched;
  })();

  return pending;
}
