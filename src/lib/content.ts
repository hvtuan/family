/**
 * DB-backed content layer. Replaces `getCollection()` from `astro:content` for
 * the 7 family content types after migrating the source of truth from
 * src/content/** files to the family.* schema in self-hosted Supabase.
 *
 * The shape returned mirrors what `getCollection()` previously yielded: each
 * row is wrapped in `{ id, data, body? }`, `data` carries camelCase fields,
 * and references (father/mother/spouse/related/etc.) appear as `{ id }`
 * objects so existing call sites keep compiling. M2M relations
 * (member.children, photo.related, timeline.related, location.members) are
 * pulled from their lookup tables and merged in here so consumers don't need
 * to know about the multi-table layout.
 *
 * All queries use the service-role client and bypass RLS — these helpers are
 * intentionally server-only and called from Astro frontmatter at build time.
 */

import { supabaseAdmin } from "./supabase/admin";

const fromFamily = (table: string) => supabaseAdmin.from(table);

// ── shared types ─────────────────────────────────────────────────────────────

export type Ref = { collection?: string; id: string };

export type MemberData = {
  id: string;
  name: string;
  nameEn?: string;
  birthName?: string;
  nickname?: string;

  gen: number;
  role: string;
  roleEn: string;
  birthOrder?: number;
  isFamilyHead: boolean;

  born: string;
  lunarBorn?: string;
  birthPlace?: string;
  died: string | null;
  lunarDied?: string;
  deathPlace?: string;
  deathAnniversary?: string;
  gravesite?: string;

  zodiac?: string;
  elementalSign?: string;

  bio: string;
  bioEn: string;

  location?: string;
  job?: string;
  jobEn?: string;
  education?: string;
  hobbies: string[];
  religion?: string;
  military?: string;

  father?: Ref;
  mother?: Ref;
  spouse?: Ref;
  children: Ref[];

  quote?: string;
  achievements: { title: string; year?: number }[];
  anecdotes: { title: string; body: string }[];

  photo?: string;
  photos: { src: string; caption: string; captionEn: string; year?: number }[];
  pattern?: "hatch" | "dots" | "lines" | "bamboo" | "glow";

  branch: "noi" | "ngoai" | "both";

  contactPublic: boolean;
  phone?: string;
  email?: string;
  address?: string;
  social?: { facebook?: string; instagram?: string; zalo?: string };

  status: "draft" | "published";
  tags: string[];
  updatedAt?: string;
};

export type MemberEntry = {
  id: string;
  slug: string;
  data: MemberData;
  body: string;
};

export type TimelineData = {
  year: number;
  date?: string;
  lunar: boolean;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  category?:
    | "founding"
    | "birth"
    | "marriage"
    | "death"
    | "milestone"
    | "gathering";
  related: Ref[];
  image?: string;
};

export type TimelineEntry = { id: string; data: TimelineData };

export type TraditionData = {
  name: string;
  nameEn: string;
  category: "food" | "festival" | "ceremony" | "craft";
  icon: "bowl" | "fish" | "leaf" | "shell" | "incense" | "blossom";
  desc: string;
  descEn: string;
  origin?: string;
  image?: string;
  tags: string[];
};

export type TraditionEntry = {
  id: string;
  data: TraditionData;
  body: string;
};

export type PhotoData = {
  src: string;
  caption: string;
  captionEn: string;
  year?: number;
  date?: string;
  location?: string;
  album?: string;
  featured: boolean;
  related: Ref[];
};

export type PhotoEntry = { id: string; data: PhotoData };

export type QuoteData = {
  text: string;
  textEn?: string;
  author: string;
  authorRef?: Ref;
  type: "proverb" | "family" | "poem" | "letter";
  context?: string;
};

export type QuoteEntry = { id: string; data: QuoteData };

export type DateData = {
  date: string;
  calendar: "lunar" | "solar";
  name: string;
  nameEn: string;
  type:
    | "memorial"
    | "festival"
    | "birthday"
    | "national"
    | "anniversary"
    | "gathering";
  member?: Ref;
  year?: number;
  recurring: boolean;
  notes?: string;
};

export type DateEntry = { id: string; data: DateData };

export type LocationData = {
  id: string;
  name: string;
  nameEn: string;
  province: string;
  coords: { lat: number; lng: number };
  isHometown: boolean;
  members: Ref[];
  description?: string;
};

export type LocationEntry = { id: string; data: LocationData };

// ── small helpers ────────────────────────────────────────────────────────────

const ref = (id: string | null | undefined, collection?: string): Ref | undefined =>
  id ? { collection, id } : undefined;

async function fetchAllRows<T>(
  table: string,
  cols: string,
  orderBy?: string,
): Promise<T[]> {
  let q = fromFamily(table).select(cols);
  if (orderBy) q = q.order(orderBy);
  const { data, error } = await q;
  if (error) throw new Error(`select ${table}: ${error.message}`);
  return (data ?? []) as unknown as T[];
}

async function fetchM2M(
  table: string,
  parentCol: string,
  childCol: string,
): Promise<Map<string | number, string[]>> {
  const { data, error } = await fromFamily(table).select(
    `${parentCol}, ${childCol}`,
  );
  if (error) throw new Error(`select ${table}: ${error.message}`);
  const map = new Map<string | number, string[]>();
  for (const row of ((data ?? []) as unknown) as Record<string, string | number>[]) {
    const p = row[parentCol] as string | number;
    const c = row[childCol] as string;
    const arr = map.get(p) ?? [];
    arr.push(c);
    map.set(p, arr);
  }
  return map;
}

// ── members ──────────────────────────────────────────────────────────────────

type MemberRow = {
  id: string;
  name: string;
  name_en: string | null;
  birth_name: string | null;
  nickname: string | null;
  gen: number;
  role: string;
  role_en: string | null;
  birth_order: number | null;
  is_family_head: boolean;
  born: string;
  lunar_born: string | null;
  birth_place: string | null;
  died: string | null;
  lunar_died: string | null;
  death_place: string | null;
  death_anniversary: string | null;
  gravesite: string | null;
  zodiac: string | null;
  elemental_sign: string | null;
  bio: string;
  bio_en: string;
  body_md: string | null;
  location: string | null;
  job: string | null;
  job_en: string | null;
  education: string | null;
  hobbies: string[];
  religion: string | null;
  military: string | null;
  father_id: string | null;
  mother_id: string | null;
  spouse_id: string | null;
  quote: string | null;
  achievements: { title: string; year?: number }[];
  anecdotes: { title: string; body: string }[];
  photo: string | null;
  embedded_photos: {
    src: string;
    caption: string;
    caption_en: string;
    year: number | null;
  }[];
  pattern: MemberData["pattern"];
  branch: MemberData["branch"];
  contact_public: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  social: MemberData["social"];
  status: MemberData["status"];
  tags: string[];
  updated_at_user: string | null;
};

function mapMember(row: MemberRow, childrenByParent: Map<string | number, string[]>): MemberEntry {
  const data: MemberData = {
    id: row.id,
    name: row.name,
    nameEn: row.name_en ?? undefined,
    birthName: row.birth_name ?? undefined,
    nickname: row.nickname ?? undefined,
    gen: row.gen,
    role: row.role,
    roleEn: row.role_en ?? "",
    birthOrder: row.birth_order ?? undefined,
    isFamilyHead: row.is_family_head,
    born: row.born,
    lunarBorn: row.lunar_born ?? undefined,
    birthPlace: row.birth_place ?? undefined,
    died: row.died,
    lunarDied: row.lunar_died ?? undefined,
    deathPlace: row.death_place ?? undefined,
    deathAnniversary: row.death_anniversary ?? undefined,
    gravesite: row.gravesite ?? undefined,
    zodiac: row.zodiac ?? undefined,
    elementalSign: row.elemental_sign ?? undefined,
    bio: row.bio,
    bioEn: row.bio_en,
    location: row.location ?? undefined,
    job: row.job ?? undefined,
    jobEn: row.job_en ?? undefined,
    education: row.education ?? undefined,
    hobbies: row.hobbies ?? [],
    religion: row.religion ?? undefined,
    military: row.military ?? undefined,
    father: ref(row.father_id, "members"),
    mother: ref(row.mother_id, "members"),
    spouse: ref(row.spouse_id, "members"),
    children: (childrenByParent.get(row.id) ?? []).map((id) => ({
      collection: "members",
      id,
    })),
    quote: row.quote ?? undefined,
    achievements: row.achievements ?? [],
    anecdotes: row.anecdotes ?? [],
    photo: row.photo ?? undefined,
    photos: (row.embedded_photos ?? []).map((p) => ({
      src: p.src,
      caption: p.caption,
      captionEn: p.caption_en,
      year: p.year ?? undefined,
    })),
    pattern: row.pattern ?? undefined,
    branch: row.branch,
    contactPublic: row.contact_public,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    social: row.social ?? undefined,
    status: row.status,
    tags: row.tags ?? [],
    updatedAt: row.updated_at_user ?? undefined,
  };

  return {
    id: row.id,
    slug: row.id,
    data,
    body: row.body_md ?? "",
  };
}

export async function getMembers(
  filter?: (entry: MemberEntry) => boolean,
): Promise<MemberEntry[]> {
  const rows = await fetchAllRows<MemberRow>("members", "*", "gen");
  const childrenByParent = await fetchM2M(
    "member_children",
    "parent_id",
    "child_id",
  );
  const all = rows.map((r) => mapMember(r, childrenByParent));
  return filter ? all.filter(filter) : all;
}

// ── timeline ─────────────────────────────────────────────────────────────────

type TimelineRow = {
  id: number;
  year: number;
  date: string | null;
  lunar: boolean;
  title: string;
  title_en: string;
  desc_text: string;
  desc_en: string;
  category: TimelineData["category"];
  image: string | null;
  source_file: string | null;
};

export async function getTimeline(): Promise<TimelineEntry[]> {
  const rows = await fetchAllRows<TimelineRow>("timeline", "*", "year");
  const m2m = await fetchM2M("timeline_members", "timeline_id", "member_id");
  return rows.map((row) => ({
    id: row.source_file ?? `timeline-${row.id}`,
    data: {
      year: row.year,
      date: row.date ?? undefined,
      lunar: row.lunar,
      title: row.title,
      titleEn: row.title_en,
      desc: row.desc_text,
      descEn: row.desc_en,
      category: row.category ?? undefined,
      related: (m2m.get(row.id) ?? []).map((id) => ({
        collection: "members",
        id,
      })),
      image: row.image ?? undefined,
    },
  }));
}

// ── traditions ───────────────────────────────────────────────────────────────

type TraditionRow = {
  id: string;
  name: string;
  name_en: string;
  category: TraditionData["category"];
  icon: TraditionData["icon"];
  desc_text: string;
  desc_en: string;
  origin: string | null;
  image: string | null;
  body_md: string | null;
  tags: string[];
};

export async function getTraditions(): Promise<TraditionEntry[]> {
  const rows = await fetchAllRows<TraditionRow>("traditions", "*", "name");
  return rows.map((row) => ({
    id: row.id,
    data: {
      name: row.name,
      nameEn: row.name_en,
      category: row.category,
      icon: row.icon,
      desc: row.desc_text,
      descEn: row.desc_en,
      origin: row.origin ?? undefined,
      image: row.image ?? undefined,
      tags: row.tags ?? [],
    },
    body: row.body_md ?? "",
  }));
}

// ── photos ───────────────────────────────────────────────────────────────────

type PhotoRow = {
  id: string;
  src: string;
  caption: string;
  caption_en: string;
  year: number | null;
  date: string | null;
  location: string | null;
  album: string | null;
  featured: boolean;
};

export async function getPhotos(): Promise<PhotoEntry[]> {
  const rows = await fetchAllRows<PhotoRow>("photos", "*", "year");
  const m2m = await fetchM2M("photo_members", "photo_id", "member_id");
  return rows.map((row) => ({
    id: row.id,
    data: {
      src: row.src,
      caption: row.caption,
      captionEn: row.caption_en,
      year: row.year ?? undefined,
      date: row.date ?? undefined,
      location: row.location ?? undefined,
      album: row.album ?? undefined,
      featured: row.featured,
      related: (m2m.get(row.id) ?? []).map((id) => ({
        collection: "members",
        id,
      })),
    },
  }));
}

// ── quotes ───────────────────────────────────────────────────────────────────

type QuoteRow = {
  id: number;
  text_vi: string;
  text_en: string | null;
  author: string;
  author_ref: string | null;
  type: QuoteData["type"];
  context: string | null;
  source_file: string | null;
};

export async function getQuotes(): Promise<QuoteEntry[]> {
  const rows = await fetchAllRows<QuoteRow>("quotes", "*", "id");
  return rows.map((row) => ({
    id: row.source_file ?? `quote-${row.id}`,
    data: {
      text: row.text_vi,
      textEn: row.text_en ?? undefined,
      author: row.author,
      authorRef: ref(row.author_ref, "members"),
      type: row.type,
      context: row.context ?? undefined,
    },
  }));
}

// ── dates ────────────────────────────────────────────────────────────────────

type DateRow = {
  id: number;
  date: string;
  calendar: DateData["calendar"];
  name: string;
  name_en: string;
  type: DateData["type"];
  member_id: string | null;
  year: number | null;
  recurring: boolean;
  notes: string | null;
  source_file: string | null;
};

export async function getDates(): Promise<DateEntry[]> {
  const rows = await fetchAllRows<DateRow>("dates", "*", "date");
  return rows.map((row) => ({
    id: row.source_file ?? `date-${row.id}`,
    data: {
      date: row.date,
      calendar: row.calendar,
      name: row.name,
      nameEn: row.name_en,
      type: row.type,
      member: ref(row.member_id, "members"),
      year: row.year ?? undefined,
      recurring: row.recurring,
      notes: row.notes ?? undefined,
    },
  }));
}

// ── locations ────────────────────────────────────────────────────────────────

type LocationRow = {
  id: string;
  name: string;
  name_en: string;
  province: string;
  lat: number;
  lng: number;
  is_hometown: boolean;
  description: string | null;
};

export async function getLocations(): Promise<LocationEntry[]> {
  const rows = await fetchAllRows<LocationRow>("locations", "*", "name");
  const m2m = await fetchM2M("location_members", "location_id", "member_id");
  return rows.map((row) => ({
    id: row.id,
    data: {
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      province: row.province,
      coords: { lat: row.lat, lng: row.lng },
      isHometown: row.is_hometown,
      members: (m2m.get(row.id) ?? []).map((id) => ({
        collection: "members",
        id,
      })),
      description: row.description ?? undefined,
    },
  }));
}
