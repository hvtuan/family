/**
 * CondolenceBook — list of approved "Lời tưởng nhớ" cards. SSR seeds
 * the first page; "Xem thêm" pulls more via /api/condolence?member=&offset=.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { t, pickLocale, type Locale, type Localized } from "@/i18n";

export type SerializedCondolence = {
  id: number;
  visitorName: string;
  visitorRelation: string | null;
  body: Localized<string>;
  createdAt: string;
};

interface Props {
  memberId: string;
  initial: SerializedCondolence[];
  lang?: Locale;
}

export default function CondolenceBook({ memberId, initial, lang = "vi" }: Props) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < 20);

  async function loadMore() {
    if (loading || done) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/condolence?member=${encodeURIComponent(memberId)}&offset=${items.length}`
      );
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.items) && json.items.length > 0) {
        setItems((prev) => [...prev, ...json.items]);
        if (json.items.length < 20) setDone(true);
      } else {
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-ink-3 italic">{t("memorial.condolenceEmpty", lang)}</p>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="list-none p-0 m-0 grid gap-4">
        {items.map((c) => (
          <li key={c.id}>
            <Card className="u-paper-texture border-gold-2/30 p-5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-ink">{c.visitorName}</span>
                {c.visitorRelation && (
                  <span className="text-xs text-ink-3">· {c.visitorRelation}</span>
                )}
                <time
                  className="ml-auto text-xs text-ink-3"
                  dateTime={c.createdAt}
                >
                  {formatVN(c.createdAt)}
                </time>
              </div>
              <p
                className="mt-3 m-0 text-ink leading-relaxed font-display whitespace-pre-line"
                style={{ fontSize: "var(--text-base)" }}
              >
                {pickLocale(c.body, lang) ?? ""}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      {!done && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="u-btn u-btn-ghost mx-auto px-5 py-2 text-sm"
        >
          {loading ? t("common.loading", lang) : t("memorial.condolenceMore", lang)}
        </button>
      )}
    </div>
  );
}

function formatVN(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
