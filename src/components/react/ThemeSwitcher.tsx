import { useStore } from "@nanostores/react";
import { $theme } from "@/stores/ui";
import type { Theme } from "@/data/site";
import "./ThemeSwitcher.css";

const THEMES: { id: Theme; vi: string; en: string; swatch: string }[] = [
  { id: "classic", vi: "Cổ điển", en: "Classic", swatch: "#f5ecd7" },
  { id: "scroll", vi: "Cuộn giấy", en: "Scroll", swatch: "#efe0c1" },
  { id: "modern", vi: "Hiện đại", en: "Modern", swatch: "#f4f1e8" },
];

export default function ThemeSwitcher() {
  const current = useStore($theme);

  return (
    <div className="theme-switcher" role="group" aria-label="Chọn giao diện">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className="theme-switcher-btn"
          aria-pressed={current === t.id}
          aria-label={`${t.vi} • ${t.en}`}
          title={`${t.vi} • ${t.en}`}
          onClick={() => $theme.set(t.id)}
        >
          <span
            className="theme-switcher-swatch"
            style={{ background: t.swatch }}
            aria-hidden="true"
          />
          <span className="theme-switcher-label">{t.vi}</span>
        </button>
      ))}
    </div>
  );
}
