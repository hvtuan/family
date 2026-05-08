import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  paper: "#FAF6EC",
  cream: "#FFFCF5",
  ink: "#3A2E1A",
  ink2: "#5A4A30",
  ink3: "#9C8A6A",
  gold: "#C9A35A",
  gold2: "#A8853F",
  vermilion: "#9B2E28",
  border: "rgba(168, 133, 63, 0.30)",
} as const;

export const PAGE_PADDING = 48;

export const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.paper,
    padding: PAGE_PADDING,
    fontFamily: "BeVietnamPro",
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 1.55,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: PAGE_PADDING,
    fontSize: 8,
    color: COLORS.ink3,
  },
  kicker: {
    fontSize: 9,
    fontFamily: "BeVietnamPro",
    fontWeight: 600,
    color: COLORS.gold2,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  display: {
    fontFamily: "Lora",
    fontStyle: "italic",
    fontSize: 32,
    color: COLORS.ink,
    lineHeight: 1.15,
  },
  bodySerif: {
    fontFamily: "Lora",
    fontSize: 11.5,
    lineHeight: 1.65,
    color: COLORS.ink,
  },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold2,
    paddingLeft: 10,
    fontStyle: "italic",
    color: COLORS.ink2,
    marginVertical: 8,
  },
  sealText: {
    fontFamily: "DancingScript",
    fontSize: 24,
    color: COLORS.gold2,
  },
});
