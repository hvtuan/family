import type { MemberEntry } from "./content";

export type ClientMemberContact = {
  phone?: string;
  email?: string;
  address?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    zalo?: string;
  };
};

export type ClientMember = {
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

  father?: string;
  mother?: string;
  spouse?: string;
  children: string[];

  quote?: string;
  achievements: { title: string; year?: number }[];
  anecdotes: { title: string; body: string }[];

  pattern?: "hatch" | "dots" | "lines" | "bamboo" | "glow";
  tags: string[];

  /** Only present if frontmatter `contactPublic === true`. */
  contact?: ClientMemberContact;

  /** Avatar URL (members.photo). Optional — falls back to initial. */
  photo?: string;

  photos: ClientPhoto[];
};

export type ClientPhoto = {
  src: string;
  width?: number;
  height?: number;
  caption: string;
  captionEn: string;
  year?: number;
};

export function toClientMember(m: MemberEntry): ClientMember {
  const d = m.data;
  const out: ClientMember = {
    // Use entry id — same as the previous Astro content-collection slug.
    id: m.id,
    name: d.name,
    nameEn: d.nameEn,
    birthName: d.birthName,
    nickname: d.nickname,

    gen: d.gen,
    role: d.role,
    roleEn: d.roleEn,
    birthOrder: d.birthOrder,
    isFamilyHead: d.isFamilyHead,

    born: d.born,
    lunarBorn: d.lunarBorn,
    birthPlace: d.birthPlace,
    died: d.died,
    lunarDied: d.lunarDied,
    deathPlace: d.deathPlace,
    deathAnniversary: d.deathAnniversary,
    gravesite: d.gravesite,

    zodiac: d.zodiac,
    elementalSign: d.elementalSign,

    bio: d.bio,
    bioEn: d.bioEn,

    location: d.location,
    job: d.job,
    jobEn: d.jobEn,
    education: d.education,
    hobbies: d.hobbies,
    religion: d.religion,
    military: d.military,

    father: d.father?.id,
    mother: d.mother?.id,
    spouse: d.spouse?.id,
    children: d.children.map((c) => c.id),

    quote: d.quote,
    achievements: d.achievements,
    anecdotes: d.anecdotes,

    pattern: d.pattern,
    tags: d.tags,

    photo: d.photo,

    photos: d.photos.map((p) => ({
      src: p.src,
      caption: p.caption,
      captionEn: p.captionEn,
      year: p.year,
    })),
  };

  if (d.contactPublic) {
    out.contact = {
      phone: d.phone,
      email: d.email,
      address: d.address,
      social: d.social,
    };
  }

  return out;
}
