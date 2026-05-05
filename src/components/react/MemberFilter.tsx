import { useMemo, useState } from "react";
import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";
import "./MemberFilter.css";

type Props = { members: ClientMember[] };

function yearRange(m: ClientMember): string {
  const b = m.born?.slice(0, 4);
  const d = m.died?.slice(0, 4);
  if (!b) return "";
  return d ? `${b} – ${d}` : `${b} – nay`;
}

function normalize(s: string): string {
  // Vietnamese-friendly normalize: lowercase + strip diacritics + collapse whitespace.
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

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
      <div className="mf-toolbar">
        <label className="mf-search">
          <span className="visually-hidden">Tìm kiếm</span>
          <input
            type="search"
            placeholder="Tìm theo tên, nghề, quê quán, thẻ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm thành viên"
          />
        </label>

        <div className="mf-pill-group" role="group" aria-label="Lọc theo thế hệ">
          <button
            type="button"
            className="mf-pill"
            aria-pressed={gen === "all"}
            onClick={() => setGen("all")}
          >
            Tất cả
          </button>
          {allGens.map((g) => (
            <button
              key={g}
              type="button"
              className="mf-pill"
              aria-pressed={gen === g}
              onClick={() => setGen(g)}
            >
              Đời {g}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="mf-pill-group" role="group" aria-label="Lọc theo thẻ">
            <button
              type="button"
              className="mf-pill mf-pill-tag"
              aria-pressed={tag === "all"}
              onClick={() => setTag("all")}
            >
              # tất cả
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className="mf-pill mf-pill-tag"
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mf-count" aria-live="polite">
        {filtered.length} thành viên qua {totalGens} thế hệ
        <span className="mf-count-en" lang="en">
          {" "}
          · {filtered.length} members across {totalGens} generations
        </span>
      </p>

      {filtered.length === 0 ? (
        <p className="mf-empty">Không có thành viên nào khớp với bộ lọc.</p>
      ) : (
        <ul className="mf-grid">
          {filtered.map((m) => (
            <li key={m.id} className="mf-card u-card" data-pattern={m.pattern}>
              <button
                type="button"
                className="mf-card-btn"
                onClick={() => $modalMember.set(m.id)}
                aria-label={`Mở chi tiết ${m.name}`}
              >
                <span className="mf-portrait" aria-hidden="true">
                  <span className="mf-mono">
                    {m.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
                  </span>
                </span>
                <span className="mf-body">
                  <span className="mf-gen">
                    Đời thứ {m.gen} ·{" "}
                    <span lang="en">Gen {m.gen}</span>
                  </span>
                  <span className="mf-name">{m.name}</span>
                  <span className="mf-role">{m.role}</span>
                  <span className="mf-years">{yearRange(m)}</span>
                  <span className="mf-bio">{m.bio}</span>
                  {m.tags.length > 0 && (
                    <span className="mf-tags" aria-label="Thẻ">
                      {m.tags.map((t) => (
                        <span key={t}>#{t}</span>
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
