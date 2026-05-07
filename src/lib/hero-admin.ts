import { supabaseAdmin } from "./supabase/admin";

export type HeroSlideRow = {
  id: number;
  photo_id: string;
  sort_order: number;
  active: boolean;
  headline_vi: string | null;
  headline_en: string | null;
  cta_label: string | null;
  cta_href: string | null;
  duration_ms: number;
  created_at: string;
  updated_at: string;
};

/** Joined shape used by the admin page + the public slideshow. */
export type HeroSlideJoined = HeroSlideRow & {
  photo: {
    id: string;
    kind: "image" | "video";
    src: string;
    src_thumb: string | null;
    src_medium: string | null;
    alt_vi: string | null;
    caption: string;
    duration_seconds: number | null;
  };
};

export async function listHeroSlides(includeInactive = true): Promise<HeroSlideJoined[]> {
  let q = supabaseAdmin
    .from("hero_slides")
    .select(`
      id, photo_id, sort_order, active,
      headline_vi, headline_en, cta_label, cta_href, duration_ms,
      created_at, updated_at,
      photo:photos!inner(id, kind, src, src_thumb, src_medium, alt_vi, caption, duration_seconds)
    `)
    .order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) throw new Error(`listHeroSlides: ${error.message}`);
  // Supabase returns photo as either an object or an array depending on
  // schema cache — normalize to object.
  return (data ?? []).map((r: any) => ({
    ...r,
    photo: Array.isArray(r.photo) ? r.photo[0] : r.photo,
  })) as HeroSlideJoined[];
}

export async function getHeroSlide(id: number): Promise<HeroSlideRow | null> {
  const { data, error } = await supabaseAdmin
    .from("hero_slides").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getHeroSlide: ${error.message}`);
  return (data as HeroSlideRow | null) ?? null;
}

export async function createHeroSlide(input: {
  photo_id: string;
  sort_order?: number;
  active?: boolean;
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
      sort_order: input.sort_order ?? 0,
      active: input.active ?? true,
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
  // Bulk update via N statements is fine for the tiny scale here
  // (typical 3-8 slides). Could batch into a single update with
  // `case ... when` if needed.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from("hero_slides").update({ sort_order: i }).eq("id", orderedIds[i]);
    if (error) throw new Error(`reorderHeroSlides[${orderedIds[i]}]: ${error.message}`);
  }
}
