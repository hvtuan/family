/**
 * English UI message catalog.
 *
 * Placeholder seed — fill incrementally as English support is enabled.
 * Missing keys fall back to vi via the t() resolver.
 *
 * NOTE: deliberately untyped against `typeof vi` because `vi` is `as const`
 * and every leaf becomes a string-literal type — that would forbid any
 * different translation. We rely on the lookup() runtime to ignore unknown
 * keys gracefully; t() falls back to vi.
 */
type EnCatalog = {
  [section: string]: { [key: string]: string | { [key: string]: string } };
};

export const en: EnCatalog = {
  common: {
    back: "Back",
    loading: "Loading...",
    error: "An error occurred",
    submit: "Submit",
    cancel: "Cancel",
    save: "Save",
  },

  memorial: {
    pageKicker: "In memory of",
    pageTitle: "In memory of {name}",
    born: "Born",
    died: "Passed",
    bornDied: "Born: {birth} · Passed: {death}",
    incenseButton: "Light a stick of incense",
    incenseCount: "{count} people have remembered",
    incenseSuccess: "Incense offered 🌸",
    condolenceTitle: "In remembrance",
    condolenceCta: "Leave a memory",
    altarTitle: "Ancestral altar",
    bannerDays: "{days} days until {name}'s memorial",
    bannerToday: "Today is {name}'s memorial",
    bannerCta: "Remember",
  },
};
