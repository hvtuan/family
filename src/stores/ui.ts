import { atom } from "nanostores";
import type { Theme } from "@/data/site";

export const $modalMember = atom<string | null>(null);
export const $theme = atom<Theme>("classic");

if (typeof window !== "undefined") {
  const url = new URL(window.location.href);
  const initial = url.searchParams.get("member");
  if (initial) $modalMember.set(initial);

  $modalMember.subscribe((id) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("member", id);
    else u.searchParams.delete("member");
    window.history.replaceState(null, "", u);
  });

  const stored = (localStorage.getItem("theme") as Theme | null) ?? "classic";
  $theme.set(stored);
  document.documentElement.dataset.theme = stored;

  $theme.subscribe((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.dataset.theme = t;
  });
}
