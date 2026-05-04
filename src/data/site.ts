export type Theme = "classic" | "scroll" | "modern";

export const NAV_LINKS = [
  { href: "/", vi: "Trang chủ", en: "Home" },
  { href: "/family-tree", vi: "Cây gia phả", en: "Family Tree" },
  { href: "/members", vi: "Thành viên", en: "Members" },
  { href: "/timeline", vi: "Mốc thời gian", en: "Timeline" },
  { href: "/album", vi: "Album", en: "Album" },
  { href: "/traditions", vi: "Truyền thống", en: "Traditions" },
  { href: "/sayings", vi: "Lời nhắn", en: "Sayings" },
  { href: "/map", vi: "Bản đồ", en: "Map" },
  { href: "/calendar", vi: "Lịch", en: "Calendar" },
] as const;

export const SITE = {
  surname: "Nguyễn",
  hometown: "Tịnh Khê, Sơn Tịnh, Quảng Ngãi",
  hometownEn: "Tinh Khe, Son Tinh, Quang Ngai",
  motto: "Uống nước nhớ nguồn",
  mottoEn: "Drink water, remember the source",
  established: 1928,
  defaultTheme: "classic" as Theme,
  monogram: "N1928",
  brand: {
    vi: "Gia đình họ Nguyễn",
    en: "The Nguyễn Family",
  },
};
