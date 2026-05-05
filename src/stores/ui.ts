import { atom } from "nanostores";
import type { Theme } from "@/data/site";

export const $modalMember = atom<string | null>(null);
export const $theme = atom<Theme>("classic");

if (typeof window !== "undefined") {
  // Initial state from URL (deep-link).
  const url = new URL(window.location.href);
  const initial = url.searchParams.get("member");
  if (initial) $modalMember.set(initial);

  // Track whether the last URL change came from us (so we don't echo).
  let suppressSync = false;

  $modalMember.subscribe((id) => {
    if (suppressSync) return;
    const u = new URL(window.location.href);
    const currentParam = u.searchParams.get("member");
    if (id) {
      u.searchParams.set("member", id);
      if (currentParam === null) {
        // Opening modal from a state with no member param → push history
        // entry so the back button "closes" the modal.
        window.history.pushState({ member: id }, "", u);
      } else {
        // Already in modal mode (e.g. swap relations) → replace.
        window.history.replaceState({ member: id }, "", u);
      }
    } else {
      if (currentParam !== null) {
        // Closing modal triggered by user (Esc / overlay click / Close button).
        // Pop the modal entry from history so URL returns to the underlying
        // page without leaving a stale ?member= param.
        u.searchParams.delete("member");
        window.history.replaceState(null, "", u);
      }
    }
  });

  // Browser back/forward → reflect URL state into the store without
  // pushing another history entry.
  window.addEventListener("popstate", () => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("member");
    suppressSync = true;
    $modalMember.set(id);
    suppressSync = false;
  });

  const stored = (localStorage.getItem("theme") as Theme | null) ?? "classic";
  $theme.set(stored);
  document.documentElement.dataset.theme = stored;

  $theme.subscribe((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.dataset.theme = t;
  });
}
