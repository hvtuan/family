import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const members = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/members" }),
  schema: ({ image }) =>
    z.object({
      id: z.string(),
      name: z.string(),
      nameEn: z.string().optional(),
      birthName: z.string().optional(),
      nickname: z.string().optional(),

      gen: z.number().int().min(1).max(8),
      role: z.string(),
      roleEn: z.string(),
      birthOrder: z.number().int().optional(),
      isFamilyHead: z.boolean().default(false),

      born: z.string(),
      lunarBorn: z.string().optional(),
      birthPlace: z.string().optional(),
      died: z.string().nullable().default(null),
      lunarDied: z.string().optional(),
      deathPlace: z.string().optional(),
      deathAnniversary: z.string().optional(),
      gravesite: z.string().optional(),

      zodiac: z.string().optional(),
      elementalSign: z.string().optional(),

      bio: z.string(),
      bioEn: z.string(),

      location: z.string().optional(),
      job: z.string().optional(),
      jobEn: z.string().optional(),
      education: z.string().optional(),
      hobbies: z.array(z.string()).default([]),
      religion: z.string().optional(),
      military: z.string().optional(),

      father: reference("members").optional(),
      mother: reference("members").optional(),
      spouse: reference("members").optional(),
      children: z.array(reference("members")).default([]),

      quote: z.string().optional(),
      achievements: z
        .array(z.object({ title: z.string(), year: z.number().optional() }))
        .default([]),
      anecdotes: z
        .array(z.object({ title: z.string(), body: z.string() }))
        .default([]),

      photo: image().optional(),
      photos: z
        .array(
          z.object({
            src: image(),
            caption: z.string(),
            captionEn: z.string(),
            year: z.number().optional(),
          }),
        )
        .default([]),
      pattern: z.enum(["hatch", "dots", "lines", "bamboo", "glow"]).optional(),

      contactPublic: z.boolean().default(false),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      social: z
        .object({
          facebook: z.string().url().optional(),
          instagram: z.string().url().optional(),
          zalo: z.string().optional(),
        })
        .optional(),

      status: z.enum(["draft", "published"]).default("published"),
      tags: z.array(z.string()).default([]),
      updatedAt: z.string().optional(),
    }),
});

const timeline = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml,json}", base: "./src/content/timeline" }),
  schema: ({ image }) =>
    z.object({
      year: z.number(),
      date: z.string().optional(),
      lunar: z.boolean().default(false),
      title: z.string(),
      titleEn: z.string(),
      desc: z.string(),
      descEn: z.string(),
      category: z
        .enum(["founding", "birth", "marriage", "death", "milestone", "gathering"])
        .optional(),
      related: z.array(reference("members")).default([]),
      image: image().optional(),
    }),
});

const traditions = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/traditions" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      nameEn: z.string(),
      category: z.enum(["food", "festival", "ceremony", "craft"]).default("food"),
      icon: z.enum(["bowl", "fish", "leaf", "shell", "incense", "blossom"]),
      desc: z.string(),
      descEn: z.string(),
      origin: z.string().optional(),
      image: image().optional(),
      tags: z.array(z.string()).default([]),
    }),
});

const photos = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml,json}", base: "./src/content/photos" }),
  schema: ({ image }) =>
    z.object({
      src: image(),
      caption: z.string(),
      captionEn: z.string(),
      year: z.number().optional(),
      date: z.string().optional(),
      location: z.string().optional(),
      related: z.array(reference("members")).default([]),
      album: z.string().optional(),
      featured: z.boolean().default(false),
    }),
});

const quotes = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml,json}", base: "./src/content/quotes" }),
  schema: z.object({
    text: z.string(),
    textEn: z.string().optional(),
    author: z.string(),
    authorRef: reference("members").optional(),
    type: z.enum(["proverb", "family", "poem", "letter"]).default("family"),
    context: z.string().optional(),
  }),
});

const dates = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml,json}", base: "./src/content/dates" }),
  schema: z.object({
    date: z.string(),
    calendar: z.enum(["lunar", "solar"]).default("solar"),
    name: z.string(),
    nameEn: z.string(),
    type: z.enum([
      "memorial",
      "festival",
      "birthday",
      "national",
      "anniversary",
      "gathering",
    ]),
    member: reference("members").optional(),
    year: z.number().optional(),
    recurring: z.boolean().default(true),
    notes: z.string().optional(),
  }),
});

const locations = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml,json}", base: "./src/content/locations" }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    nameEn: z.string(),
    province: z.string(),
    coords: z.object({ lat: z.number(), lng: z.number() }),
    isHometown: z.boolean().default(false),
    members: z.array(reference("members")).default([]),
    description: z.string().optional(),
  }),
});

export const collections = { members, timeline, traditions, photos, quotes, dates, locations };
