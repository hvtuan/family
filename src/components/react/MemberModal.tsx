import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import useEmblaCarousel from "embla-carousel-react";
import { $modalMember } from "@/stores/ui";
import type { ClientMember, ClientPhoto } from "@/lib/members-client";
import "./MemberModal.css";

type Props = { members: ClientMember[] };

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

export default function MemberModal({ members }: Props) {
  const id = useStore($modalMember);

  const byId = useMemo(() => {
    const m = new Map<string, ClientMember>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const member = id ? byId.get(id) ?? null : null;
  const open = member !== null;

  // If id is set but unknown, silently close.
  useEffect(() => {
    if (id && !byId.has(id)) $modalMember.set(null);
  }, [id, byId]);

  // Intercept clicks on anchors with `?member=` so modal opens
  // without full-page navigation.
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
        // ignore malformed urls
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
        <Dialog.Overlay className="mm-overlay" />
        <Dialog.Content className="mm-content" aria-describedby={undefined}>
          {member && <ModalBody member={member} byId={byId} />}
          <Dialog.Close className="mm-close" aria-label="Đóng">
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
}: {
  member: ClientMember;
  byId: Map<string, ClientMember>;
}) {
  const hasRelations =
    m.father || m.mother || m.spouse || m.children.length > 0;
  const hasAchievements = m.achievements.length > 0;
  const hasAnecdotes = m.anecdotes.length > 0;
  const hasContact = !!m.contact;
  const hasPhotos = m.photos.length > 0;

  // Build tab list dynamically.
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
      <header className="mm-head">
        <div className="mm-mono" aria-hidden="true">
          {m.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
        </div>
        <div className="mm-head-text">
          <p className="mm-gen">
            Đời thứ {m.gen} • <span lang="en">Generation {m.gen}</span>
          </p>
          <Dialog.Title asChild>
            <h2 className="mm-name">{m.name}</h2>
          </Dialog.Title>
          {m.nameEn && (
            <p className="mm-name-en" lang="en">
              {m.nameEn}
            </p>
          )}
          <p className="mm-role">
            {m.role}
            <span className="mm-years"> · {yearRange(m)}</span>
          </p>
        </div>
      </header>

      <Tabs.Root defaultValue="bio" className="mm-tabs">
        <Tabs.List className="mm-tab-list" aria-label="Phần">
          {tabs.map((t) => (
            <Tabs.Trigger key={t.id} value={t.id} className="mm-tab-trigger">
              <span>{t.vi}</span>
              <span className="mm-tab-trigger-en" lang="en">
                {t.en}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="bio" className="mm-tab-panel">
          <p className="mm-bio">{m.bio}</p>
          <p className="mm-bio-en" lang="en">
            {m.bioEn}
          </p>

          <dl className="mm-meta">
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

          {m.hobbies.length > 0 && (
            <div className="mm-section">
              <h3>Sở thích</h3>
              <ul className="mm-chips">
                {m.hobbies.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {m.quote && (
            <blockquote className="mm-quote">
              <p>"{m.quote}"</p>
            </blockquote>
          )}
        </Tabs.Content>

        {hasPhotos && (
          <Tabs.Content value="photos" className="mm-tab-panel">
            <PhotoCarousel photos={m.photos} memberName={m.name} />
          </Tabs.Content>
        )}

        {hasRelations && (
          <Tabs.Content value="relations" className="mm-tab-panel">
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
          <Tabs.Content value="achievements" className="mm-tab-panel">
            <ul className="mm-achievements">
              {m.achievements.map((a, i) => (
                <li key={i}>
                  <span className="mm-achievement-title">{a.title}</span>
                  {a.year && <span className="mm-achievement-year">{a.year}</span>}
                </li>
              ))}
            </ul>
          </Tabs.Content>
        )}

        {hasAnecdotes && (
          <Tabs.Content value="anecdotes" className="mm-tab-panel">
            <div className="mm-anecdotes">
              {m.anecdotes.map((a, i) => (
                <article key={i}>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </article>
              ))}
            </div>
          </Tabs.Content>
        )}

        {hasContact && m.contact && (
          <Tabs.Content value="contact" className="mm-tab-panel">
            <dl className="mm-meta">
              {m.contact.phone && (
                <Meta
                  label="Điện thoại"
                  value={
                    <a href={`tel:${m.contact.phone}`} className="mm-link">
                      {m.contact.phone}
                    </a>
                  }
                />
              )}
              {m.contact.email && (
                <Meta
                  label="Email"
                  value={
                    <a href={`mailto:${m.contact.email}`} className="mm-link">
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
                      className="mm-link"
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
                      className="mm-link"
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
    <div className="mm-meta-row">
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {sub && <span className="mm-meta-sub">{sub}</span>}
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

  // Keyboard arrow navigation when carousel area has focus.
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
      className="mm-carousel"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={`Ảnh của ${memberName}`}
      onKeyDown={onKeyDown}
    >
      <div className="mm-embla" ref={emblaRef}>
        <div className="mm-embla-track">
          {photos.map((p, i) => (
            <figure key={i} className="mm-embla-slide">
              <div className="mm-embla-img">
                <img
                  src={p.src}
                  width={p.width}
                  height={p.height}
                  alt={p.caption}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>
                <p>{p.caption}</p>
                {p.captionEn?.trim() && (
                  <p lang="en" className="mm-embla-caption-en">
                    {p.captionEn}
                  </p>
                )}
                {p.year && <span className="mm-embla-year">{p.year}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="mm-embla-controls">
        <button
          type="button"
          className="mm-embla-arrow"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="Ảnh trước"
        >
          ←
        </button>
        <ol className="mm-embla-dots" aria-label="Chọn ảnh">
          {photos.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                className="mm-embla-dot"
                aria-current={i === selectedIdx ? "true" : undefined}
                aria-label={`Ảnh ${i + 1} / ${photos.length}`}
                onClick={() => scrollTo(i)}
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="mm-embla-arrow"
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
    <section className="mm-relation-group">
      <h3>{label}</h3>
      <ul className="mm-relation-list">
        {resolved.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="mm-relation-card"
              onClick={() => $modalMember.set(p.id)}
            >
              <span className="mm-relation-mono" aria-hidden="true">
                {p.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
              </span>
              <span className="mm-relation-text">
                <span className="mm-relation-name">{p.name}</span>
                <span className="mm-relation-role">{p.role}</span>
                <span className="mm-relation-years">{yearRange(p)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
