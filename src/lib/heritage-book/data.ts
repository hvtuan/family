import {
  getMembers, getQuotes, getTraditions, getPhotos,
  type MemberEntry, type QuoteEntry, type TraditionEntry, type PhotoData,
} from "@/lib/content";
import { toClientMember, type ClientMember } from "@/lib/members-client";
import { getDeceasedMembers, type MemorialMember } from "@/lib/memorial";
import { getSiteIdentity } from "@/lib/settings";

export interface BuildBookOptions {
  includeDrafts: boolean;
  includePhotos: boolean;
  includeTraditions: boolean;
  includeAlbum: boolean;
  lang: "vi" | "en";
}

export interface BookData {
  surname: string;
  brand: { vi: string; en: string };
  hometown: string;
  motto: string;
  established: number;
  publicationYear: number;
  lang: "vi" | "en";
  members: ClientMember[];
  deceasedMembers: MemorialMember[];
  quotes: QuoteEntry[];
  traditions: TraditionEntry[];
  photos: PhotoData[];
}

export async function buildBookData(opts: BuildBookOptions): Promise<BookData> {
  const site = await getSiteIdentity();

  const allMemberEntries = await getMembers();
  const memberEntries = opts.includeDrafts
    ? allMemberEntries
    : allMemberEntries.filter((m) => m.data.status === "published");

  const members = memberEntries
    .map(toClientMember)
    .sort((a, b) => a.gen - b.gen || (a.birthOrder ?? 99) - (b.birthOrder ?? 99));

  const deceasedMembers = await getDeceasedMembers();

  const quotes = await getQuotes();
  const traditions = opts.includeTraditions ? await getTraditions() : [];

  let photos: PhotoData[] = [];
  if (opts.includeAlbum || opts.includePhotos) {
    const allPhotos = await getPhotos();
    photos = allPhotos
      .map((p) => p.data)
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.year ?? 0) - (a.year ?? 0);
      })
      .slice(0, 32);
  }

  return {
    surname: site.surname || "Nguyễn",
    brand: { vi: site.brand.vi || "Gia đình", en: site.brand.en || "Family" },
    hometown: site.hometown || "",
    motto: site.motto || "",
    established: site.established || 1900,
    publicationYear: new Date().getFullYear(),
    lang: opts.lang,
    members,
    deceasedMembers,
    quotes,
    traditions,
    photos,
  };
}
