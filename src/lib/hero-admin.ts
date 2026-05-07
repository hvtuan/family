import { supabaseAdmin } from "./supabase/admin";

export type HeroSlideRow = {
  id: number;
  photo_id: string;
  photo_id_mobile: string | null;
  sort_order: number;
  active: boolean;
  active_from: string | null;
  active_to: string | null;
  headline_vi: string | null;
  headline_en: string | null;
  cta_label: string | null;
  cta_href: string | null;
  duration_ms: number;
  created_at: string;
  updated_at: string;
};

type PhotoLite = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  src_medium: string | null;
  alt_vi: string | null;
  caption: string;
  duration_seconds: number | null;
};

/** Joined shape used by the admin page + the public slideshow. */
export type HeroSlideJoined = HeroSlideRow & {
  photo: PhotoLite;
  photo_mobile: PhotoLite | null;
};

const SELECT_COLS = `
  id, photo_id, photo_id_mobile, sort_order, active, active_from, active_to,
  headline_vi, headline_en, cta_label, cta_href, duration_ms,
  created_at, updated_at,
  photo:photos!hero_slides_photo_id_fkey(id, kind, src, src_thumb, src_medium, alt_vi, caption, duration_seconds),
  photo_mobile:photos!hero_slides_photo_id_mobile_fkey(id, kind, src, src_thumb, src_medium, alt_vi, caption, duration_seconds)
`;

function normalizePhoto(r: any, key: string): PhotoLite | null {
  const v = r[key];
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v as PhotoLite;
}

export async function listHeroSlides(includeInactive = true): Promise<HeroSlideJoined[]> {
  let q = supabaseAdmin
    .from("hero_slides")
    .select(SELECT_COLS)
    .order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) throw new Error(`listHeroSlides: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    ...r,
    photo: normalizePhoto(r, "photo")!,
    photo_mobile: normalizePhoto(r, "photo_mobile"),
  })) as HeroSlideJoined[];
}

/** Filter out slides whose schedule window is in the future / past. */
export function isInActiveWindow(
  slide: Pick<HeroSlideRow, "active_from" | "active_to">,
  now: Date = new Date(),
): boolean {
  if (slide.active_from && new Date(slide.active_from).getTime() > now.getTime()) {
    return false;
  }
  if (slide.active_to && new Date(slide.active_to).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export async function getHeroSlide(id: number): Promise<HeroSlideRow | null> {
  const { data, error } = await supabaseAdmin
    .from("hero_slides").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getHeroSlide: ${error.message}`);
  return (data as HeroSlideRow | null) ?? null;
}

export async function createHeroSlide(input: {
  photo_id: string;
  photo_id_mobile?: string | null;
  sort_order?: number;
  active?: boolean;
  active_from?: string | null;
  active_to?: string | null;
  headline_vi?: string | null;
  headline_en?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  duration_ms?: number;
}): Promise<HeroSlideRow> {
  const { data, error } = await supabaseAdmin
    .from("hero_slides")
    .insert({
      photo_id: input.photo_id,
      photo_id_mobile: input.photo_id_mobile ?? null,
      sort_order: input.sort_order ?? 0,
      active: input.active ?? true,
      active_from: input.active_from ?? null,
      active_to: input.active_to ?? null,
      headline_vi: input.headline_vi ?? null,
      headline_en: input.headline_en ?? null,
      cta_label: input.cta_label ?? null,
      cta_href: input.cta_href ?? null,
      duration_ms: input.duration_ms ?? 6000,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createHeroSlide: ${error.message}`);
  return data as HeroSlideRow;
}

export async function updateHeroSlide(
  id: number,
  patch: Partial<Omit<HeroSlideRow, "id" | "created_at" | "updated_at">>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("hero_slides").update(patch).eq("id", id);
  if (error) throw new Error(`updateHeroSlide: ${error.message}`);
}

export async function deleteHeroSlide(id: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("hero_slides").delete().eq("id", id);
  if (error) throw new Error(`deleteHeroSlide: ${error.message}`);
}

/** Reorder a contiguous list of slide IDs to match the given sequence. */
export async function reorderHeroSlides(orderedIds: number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from("hero_slides").update({ sort_order: i }).eq("id", orderedIds[i]);
    if (error) throw new Error(`reorderHeroSlides[${orderedIds[i]}]: ${error.message}`);
  }
}
