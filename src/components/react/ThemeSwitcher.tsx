import { useStore } from "@nanostores/react";
import { $theme } from "@/stores/ui";
import type { Theme } from "@/data/site";

const THEMES: { id: Theme; vi: string; en: string; swatch: string }[] = [
  { id: "classic", vi: "Cổ điển", en: "Classic", swatch: "#f5ecd7" },
  { id: "scroll", vi: "Cuộn giấy", en: "Scroll", swatch: "#efe0c1" },
  { id: "modern", vi: "Hiện đại", en: "Modern", swatch: "#f4f1e8" },
];

export default function ThemeSwitcher() {
  const current = useStore($theme);

  return (
    <div
      className="inline-flex gap-1 p-1 bg-paper-2 border border-line rounded-full"
      role="group"
      aria-label="Chọn giao diện"
    >
      {THEMES.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={[
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[0.78rem] cursor-pointer border-0 transition-colors duration-150",
              active
                ? "bg-ink text-paper"
                : "bg-transparent text-ink-2 hover:bg-paper-3",
            ].join(" ")}
            aria-pressed={active}
            aria-label={`${t.vi} • ${t.en}`}
            title={`${t.vi} • ${t.en}`}
            onClick={() => $theme.set(t.id)}
          >
            <span
              className={[
                "inline-block w-3.5 h-3.5 rounded-full flex-none border border-black/15",
                active ? "outline outline-2 outline-offset-1 outline-paper" : "",
              ].join(" ")}
              style={{ background: t.swatch }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap max-mobile:hidden">{t.vi}</span>
          </button>
        );
      })}
    </div>
  );
}
