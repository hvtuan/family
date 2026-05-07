import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import useEmblaCarousel from "embla-carousel-react";
import { $modalMember } from "@/stores/ui";
import type { ClientMember, ClientPhoto } from "@/lib/members-client";
import MemberPlacesMap from "./MemberPlacesMap";

export type LocationLookup = Record<
  string,
  { name: string; lat: number; lng: number; province?: string }
>;

type Props = {
  members: ClientMember[];
  locationLookup?: LocationLookup;
  googleMapsApiKey?: string;
};

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function yearRange(m: ClientMember): string {
  const b = m.born?.slice(0, 4);
  const d = m.died?.slice(0, 4);
  if (!b) return "";
  return d ? `${b} – ${d}` : `${b} – nay`;
}

export default function MemberModal({
  members,
  locationLookup = {},
  googleMapsApiKey,
}: Props) {
  const id = useStore($modalMember);

  const byId = useMemo(() => {
    const m = new Map<string, ClientMember>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const member = id ? byId.get(id) ?? null : null;
  const open = member !== null;

  useEffect(() => {
    if (id && !byId.has(id)) $modalMember.set(null);
  }, [id, byId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
        return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!a) return;
      try {
        const url = new URL(a.href, window.location.href);
        const memberParam = url.searchParams.get("member");
        if (!memberParam) return;
        if (!byId.has(memberParam)) return;
        e.preventDefault();
        $modalMember.set(memberParam);
      } catch {
        /* ignore malformed urls */
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [byId]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) $modalMember.set(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink/55 backdrop-blur-[2px] animate-mm-fade" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,calc(100vw-1.5rem))] max-h-[calc(100vh-2rem)] overflow-auto bg-cream text-ink border border-line rounded-2xl shadow-paper-2 z-[90] p-0 animate-mm-slide max-mobile:w-screen max-mobile:max-h-screen max-mobile:rounded-none max-mobile:top-0 max-mobile:left-0 max-mobile:[transform:none]"
          aria-describedby={undefined}
        >
          {member && (
            <ModalBody
              member={member}
              byId={byId}
              locationLookup={locationLookup}
              googleMapsApiKey={googleMapsApiKey}
            />
          )}
          <Dialog.Close
            className="absolute top-2 right-2 w-9 h-9 border-0 rounded-full bg-paper-2 text-ink text-[1.4rem] leading-none cursor-pointer flex items-center justify-center z-10 hover:bg-paper-3"
            aria-label="Đóng"
          >
            ×
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModalBody({
  member: m,
  byId,
  locationLookup,
  googleMapsApiKey,
}: {
  member: ClientMember;
  byId: Map<string, ClientMember>;
  locationLookup: LocationLookup;
  googleMapsApiKey?: string;
}) {
  const hasRelations =
    m.father || m.mother || m.spouse || m.children.length > 0;
  const hasAchievements = m.achievements.length > 0;
  const hasAnecdotes = m.anecdotes.length > 0;
  const hasContact = !!m.contact;
  const hasPhotos = m.photos.length > 0;

  const tabs: { id: string; vi: string; en: string }[] = [
    { id: "bio", vi: "Tiểu sử", en: "Biography" },
  ];
  if (hasPhotos) tabs.push({ id: "photos", vi: "Ảnh", en: "Photos" });
  if (hasRelations) tabs.push({ id: "relations", vi: "Quan hệ", en: "Relations" });
  if (hasAchievements)
    tabs.push({ id: "achievements", vi: "Thành tích", en: "Achievements" });
  if (hasAnecdotes) tabs.push({ id: "anecdotes", vi: "Giai thoại", en: "Stories" });
  if (hasContact) tabs.push({ id: "contact", vi: "Liên lạc", en: "Contact" });

  return (
    <>
      <header className="flex gap-4 p-6 pr-13 pb-4 items-start border-b border-line bg-paper-2 max-mobile:py-5 max-mobile:px-4 max-mobile:pr-13 max-mobile:pb-3.5">
        <div
          className="flex-none w-16 h-16 flex items-center justify-center border-[3px] border-vermilion rounded-xl bg-vermilion/[0.04] text-vermilion font-display font-bold text-[1.6rem]"
          aria-hidden="true"
        >
          {m.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-[0.7rem] tracking-[0.18em] uppercase text-gold-2">
            Đời thứ {m.gen} • <span lang="en">Generation {m.gen}</span>
          </p>
          <Dialog.Title asChild>
            <h2 className="font-display text-[1.55rem] m-0 leading-[1.15] text-ink">
              {m.name}
            </h2>
          </Dialog.Title>
          {m.nameEn?.trim() && (
            <p
              className="text-[0.78rem] tracking-[0.14em] uppercase text-ink-3"
              lang="en"
            >
              {m.nameEn}
            </p>
          )}
          <p className="mt-1 text-[0.92rem] text-ink-2">
            {m.role}
            <span className="text-ink-3 [font-feature-settings:'tnum'_1]"> · {yearRange(m)}</span>
          </p>
        </div>
      </header>

      <Tabs.Root defaultValue="bio">
        <Tabs.List
          className="flex gap-1 px-4 pt-2 overflow-x-auto border-b border-line bg-paper-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Phần"
        >
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="inline-flex flex-col gap-0.5 px-3 pt-2 pb-2.5 border-0 bg-transparent cursor-pointer font-inherit text-ink-2 border-b-2 border-transparent whitespace-nowrap transition-colors duration-150 hover:text-ink data-[state=active]:text-vermilion data-[state=active]:border-vermilion data-[state=active]:font-semibold"
            >
              <span>{t.vi}</span>
              <span
                className="text-[0.6rem] tracking-[0.16em] uppercase text-ink-3"
                lang="en"
              >
                {t.en}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content
          value="bio"
          className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
        >
          <p className="text-base leading-relaxed text-ink">{m.bio}</p>
          {m.bioEn?.trim() && (
            <p className="text-[0.88rem] text-ink-3 italic leading-normal" lang="en">
              {m.bioEn}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-2.5 gap-x-5 m-0 pt-2 border-t border-dashed border-line max-mobile:grid-cols-1">
            <Meta label="Sinh" value={fmtDate(m.born)} sub={m.lunarBorn} />
            {m.died && (
              <Meta label="Mất" value={fmtDate(m.died)} sub={m.lunarDied} />
            )}
            <Meta label="Quê quán" value={m.birthPlace} />
            {m.deathPlace && <Meta label="Nơi mất" value={m.deathPlace} />}
            {m.gravesite && <Meta label="Phần mộ" value={m.gravesite} />}
            <Meta label="Nghề" value={m.job} sub={m.jobEn} />
            <Meta label="Học vấn" value={m.education} />
            <Meta label="Tôn giáo" value={m.religion} />
            <Meta
              label="Mệnh / Cầm tinh"
              value={
                [m.zodiac, m.elementalSign].filter(Boolean).join(" • ") || undefined
              }
            />
          </dl>

          <MemberPlacesMap
            apiKey={googleMapsApiKey}
            locationLookup={locationLookup}
            birthPlace={m.birthPlace}
            deathPlace={m.deathPlace}
            gravesite={m.gravesite}
          />

          {m.hobbies.length > 0 && (
            <div>
              <h3 className="text-[0.78rem] tracking-[0.16em] uppercase text-gold-2 m-0 mb-2">
                Sở thích
              </h3>
              <ul className="list-none m-0 p-0 flex flex-wrap gap-1.5">
                {m.hobbies.map((h) => (
                  <li
                    key={h}
                    className="px-2.5 py-1 bg-paper-2 border border-line rounded-full text-[0.82rem]"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {m.quote && (
            <blockquote className="m-0 p-4 px-5 border-l-[3px] border-vermilion bg-paper-2 rounded-r-xl font-display italic text-ink">
              <p>"{m.quote}"</p>
            </blockquote>
          )}
        </Tabs.Content>

        {hasPhotos && (
          <Tabs.Content
            value="photos"
            className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
          >
            <PhotoCarousel photos={m.photos} memberName={m.name} />
          </Tabs.Content>
        )}

        {hasRelations && (
          <Tabs.Content
            value="relations"
            className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
          >
            <RelationGroup label="Cha" ids={m.father ? [m.father] : []} byId={byId} />
            <RelationGroup label="Mẹ" ids={m.mother ? [m.mother] : []} byId={byId} />
            <RelationGroup
              label="Vợ / Chồng"
              ids={m.spouse ? [m.spouse] : []}
              byId={byId}
            />
            <RelationGroup label="Con" ids={m.children} byId={byId} />
          </Tabs.Content>
        )}

        {hasAchievements && (
          <Tabs.Content
            value="achievements"
            className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
          >
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {m.achievements.map((a, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-3 px-3.5 py-2.5 bg-paper-2 border-l-[3px] border-gold rounded-r-lg"
                >
                  <span className="flex-1 text-[0.92rem] text-ink">{a.title}</span>
                  {a.year && (
                    <span className="font-mono text-[0.85rem] text-vermilion [font-feature-settings:'tnum'_1]">
                      {a.year}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Tabs.Content>
        )}

        {hasAnecdotes && (
          <Tabs.Content
            value="anecdotes"
            className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
          >
            <div className="flex flex-col gap-4">
              {m.anecdotes.map((a, i) => (
                <article key={i}>
                  <h3 className="text-[0.78rem] tracking-[0.16em] uppercase text-gold-2 m-0 mb-2">
                    {a.title}
                  </h3>
                  <p className="text-ink-2 leading-relaxed">{a.body}</p>
                </article>
              ))}
            </div>
          </Tabs.Content>
        )}

        {hasContact && m.contact && (
          <Tabs.Content
            value="contact"
            className="p-5 px-6 pb-6 flex flex-col gap-4 max-mobile:px-4 max-mobile:py-4"
          >
            <dl className="grid grid-cols-2 gap-2.5 gap-x-5 m-0 max-mobile:grid-cols-1">
              {m.contact.phone && (
                <Meta
                  label="Điện thoại"
                  value={
                    <a
                      href={`tel:${m.contact.phone}`}
                      className="text-vermilion font-semibold hover:underline"
                    >
                      {m.contact.phone}
                    </a>
                  }
                />
              )}
              {m.contact.email && (
                <Meta
                  label="Email"
                  value={
                    <a
                      href={`mailto:${m.contact.email}`}
                      className="text-vermilion font-semibold hover:underline"
                    >
                      {m.contact.email}
                    </a>
                  }
                />
              )}
              {m.contact.address && (
                <Meta label="Địa chỉ" value={m.contact.address} />
              )}
              {m.contact.social?.facebook && (
                <Meta
                  label="Facebook"
                  value={
                    <a
                      href={m.contact.social.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-vermilion font-semibold hover:underline"
                    >
                      Mở liên kết ↗
                    </a>
                  }
                />
              )}
              {m.contact.social?.instagram && (
                <Meta
                  label="Instagram"
                  value={
                    <a
                      href={m.contact.social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-vermilion font-semibold hover:underline"
                    >
                      Mở liên kết ↗
                    </a>
                  }
                />
              )}
              {m.contact.social?.zalo && (
                <Meta label="Zalo" value={m.contact.social.zalo} />
              )}
            </dl>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </>
  );
}

function Meta({
  label,
  value,
  sub,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[0.65rem] tracking-[0.18em] uppercase text-ink-3 font-semibold">
        {label}
      </dt>
      <dd className="m-0 text-[0.92rem] text-ink flex flex-col gap-0.5">
        <span>{value}</span>
        {sub && (
          <span className="text-[0.78rem] text-ink-3 italic">{sub}</span>
        )}
      </dd>
    </div>
  );
}

function PhotoCarousel({
  photos,
  memberName,
}: {
  photos: ClientPhoto[];
  memberName: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false });
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!emblaApi) return;
      if (e.key === "ArrowLeft") {
        emblaApi.scrollPrev();
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        emblaApi.scrollNext();
        e.preventDefault();
      }
    },
    [emblaApi],
  );

  const scrollTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );

  return (
    <div
      className="flex flex-col gap-2.5 outline-none focus-visible:outline-2 focus-visible:outline-vermilion focus-visible:outline-offset-2 focus-visible:rounded-xl"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={`Ảnh của ${memberName}`}
      onKeyDown={onKeyDown}
    >
      <div
        className="overflow-hidden rounded-xl bg-paper-2 border border-line"
        ref={emblaRef}
      >
        <div className="flex select-none [-webkit-touch-callout:none]">
          {photos.map((p, i) => (
            <figure
              key={i}
              className="flex-[0_0_100%] min-w-0 m-0 flex flex-col"
            >
              <div className="aspect-[4/3] bg-paper-3 flex items-center justify-center overflow-hidden">
                <img
                  src={p.src}
                  width={p.width}
                  height={p.height}
                  alt={p.caption}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover block"
                />
              </div>
              <figcaption className="px-3.5 py-2.5 flex flex-col gap-0.5 border-t border-line bg-cream">
                <p className="text-[0.95rem] text-ink">{p.caption}</p>
                {p.captionEn?.trim() && (
                  <p
                    lang="en"
                    className="text-[0.78rem] italic text-ink-3"
                  >
                    {p.captionEn}
                  </p>
                )}
                {p.year && (
                  <span className="font-mono text-[0.72rem] text-ink-3 self-start px-1.5 py-px border border-line rounded-full mt-1">
                    {p.year}
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center justify-center">
        <button
          type="button"
          className="w-9 h-9 border border-line-strong bg-paper-2 text-ink rounded-full cursor-pointer text-[1.05rem] inline-flex items-center justify-center hover:bg-paper-3"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="Ảnh trước"
        >
          ←
        </button>
        <ol
          className="list-none m-0 p-0 flex gap-1.5 items-center"
          aria-label="Chọn ảnh"
        >
          {photos.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                className={[
                  "w-2.5 h-2.5 rounded-full border-0 p-0 cursor-pointer transition-transform",
                  i === selectedIdx
                    ? "bg-vermilion scale-[1.2]"
                    : "bg-line-strong",
                ].join(" ")}
                aria-current={i === selectedIdx ? "true" : undefined}
                aria-label={`Ảnh ${i + 1} / ${photos.length}`}
                onClick={() => scrollTo(i)}
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="w-9 h-9 border border-line-strong bg-paper-2 text-ink rounded-full cursor-pointer text-[1.05rem] inline-flex items-center justify-center hover:bg-paper-3"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="Ảnh kế"
        >
          →
        </button>
      </div>
    </div>
  );
}

function RelationGroup({
  label,
  ids,
  byId,
}: {
  label: string;
  ids: string[];
  byId: Map<string, ClientMember>;
}) {
  const resolved = ids.map((id) => byId.get(id)).filter(Boolean) as ClientMember[];
  if (resolved.length === 0) return null;
  return (
    <section>
      <h3 className="text-[0.78rem] tracking-[0.16em] uppercase text-gold-2 m-0 mb-2">
        {label}
      </h3>
      <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {resolved.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="inline-flex items-center gap-2.5 px-3.5 py-2.5 w-full border border-line-strong bg-paper-2 rounded-xl cursor-pointer font-inherit text-inherit text-left transition-all duration-150 hover:-translate-y-px hover:shadow-paper-1"
              onClick={() => $modalMember.set(p.id)}
            >
              <span
                className="flex-none w-8 h-8 flex items-center justify-center border-2 border-vermilion rounded-lg text-vermilion font-display font-bold text-[0.92rem] bg-vermilion/[0.04]"
                aria-hidden="true"
              >
                {p.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
              </span>
              <span className="flex flex-col leading-tight gap-0.5 min-w-0">
                <span className="font-display font-bold text-[0.95rem] text-ink">
                  {p.name}
                </span>
                <span className="text-[0.75rem] text-ink-2">{p.role}</span>
                <span className="text-[0.7rem] text-ink-3 [font-feature-settings:'tnum'_1]">
                  {yearRange(p)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
