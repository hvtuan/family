import { useMemo, useState } from "react";
import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

type Props = { members: ClientMember[] };

function yearRange(m: ClientMember): string {
  const b = m.born?.slice(0, 4);
  const d = m.died?.slice(0, 4);
  if (!b) return "";
  return d ? `${b} – ${d}` : `${b} – nay`;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const pillBase =
  "font-inherit text-[0.82rem] px-3 py-1 border border-line-strong bg-paper-2 text-ink-2 rounded-full cursor-pointer transition-colors duration-150 hover:bg-paper-3 aria-pressed:bg-vermilion aria-pressed:text-paper aria-pressed:border-vermilion";
const pillTag = pillBase + " font-mono text-[0.78rem]";

export default function MemberFilter({ members }: Props) {
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState<number | "all">("all");
  const [tag, setTag] = useState<string | "all">("all");

  const allGens = useMemo(
    () => Array.from(new Set(members.map((m) => m.gen))).sort((a, b) => a - b),
    [members],
  );
  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) for (const t of m.tags) s.add(t);
    return Array.from(s).sort();
  }, [members]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return members
      .filter((m) => {
        if (gen !== "all" && m.gen !== gen) return false;
        if (tag !== "all" && !m.tags.includes(tag)) return false;
        if (q) {
          const haystack = normalize(
            [
              m.name,
              m.nameEn ?? "",
              m.nickname ?? "",
              m.role,
              m.bio,
              m.location ?? "",
              m.job ?? "",
              m.tags.join(" "),
            ].join(" "),
          );
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.gen - b.gen || (a.birthOrder ?? 99) - (b.birthOrder ?? 99),
      );
  }, [members, query, gen, tag]);

  const totalGens = useMemo(
    () => new Set(filtered.map((m) => m.gen)).size,
    [filtered],
  );

  return (
    <>
      <div className="flex flex-col gap-3.5 pb-6">
        <label className="block w-full">
          <span className="sr-only">Tìm kiếm</span>
          <input
            type="search"
            placeholder="Tìm theo tên, nghề, quê quán, thẻ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm thành viên"
            className="w-full font-inherit px-4 py-2.5 border border-line-strong rounded-full bg-cream text-ink focus:outline-2 focus:outline-vermilion focus:outline-offset-2"
          />
        </label>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo thế hệ">
          <button
            type="button"
            className={pillBase}
            aria-pressed={gen === "all"}
            onClick={() => setGen("all")}
          >
            Tất cả
          </button>
          {allGens.map((g) => (
            <button
              key={g}
              type="button"
              className={pillBase}
              aria-pressed={gen === g}
              onClick={() => setGen(g)}
            >
              Đời {g}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo thẻ">
            <button
              type="button"
              className={pillTag}
              aria-pressed={tag === "all"}
              onClick={() => setTag("all")}
            >
              # tất cả
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={pillTag}
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-ink-3 mb-4 text-[0.92rem]" aria-live="polite">
        {filtered.length} thành viên qua {totalGens} thế hệ
        <span className="text-[0.78rem] tracking-wide italic" lang="en">
          {" "}· {filtered.length} members across {totalGens} generations
        </span>
      </p>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-ink-3">
          Không có thành viên nào khớp với bộ lọc.
        </p>
      ) : (
        <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="u-card overflow-hidden p-0"
              data-pattern={m.pattern}
            >
              <button
                type="button"
                className="flex flex-col w-full h-full border-0 bg-transparent p-0 text-left font-inherit text-inherit cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                onClick={() => $modalMember.set(m.id)}
                aria-label={`Mở chi tiết ${m.name}`}
              >
                <span
                  className="flex h-[180px] items-center justify-center border-b border-line bg-paper-3 [background:radial-gradient(circle_at_30%_30%,rgba(201,163,90,0.25),transparent_60%),var(--color-paper-3)]"
                  aria-hidden="true"
                >
                  <span className="font-display font-bold text-7xl text-vermilion opacity-85">
                    {m.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
                  </span>
                </span>
                <span className="flex flex-col gap-1.5 p-5 flex-1">
                  <span className="text-[0.7rem] tracking-[0.18em] uppercase text-gold-2">
                    Đời thứ {m.gen} · <span lang="en">Gen {m.gen}</span>
                  </span>
                  <span className="font-display font-bold text-[1.35rem] leading-tight text-ink">
                    {m.name}
                  </span>
                  <span className="text-[0.95rem] text-ink-2">{m.role}</span>
                  <span className="text-[0.82rem] text-ink-3 [font-feature-settings:'tnum'_1]">
                    {yearRange(m)}
                  </span>
                  <span className="text-[0.92rem] text-ink-2 leading-[1.55] mt-1">
                    {m.bio}
                  </span>
                  {m.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1.5 mt-2" aria-label="Thẻ">
                      {m.tags.map((t) => (
                        <span
                          key={t}
                          className="font-mono text-[0.72rem] px-2 py-0.5 bg-paper-2 text-ink-2 rounded-full"
                        >
                          #{t}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
