import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { BookData } from "../data";

interface Props { data: BookData; }

interface TocEntry { label: string; page: number; }

export function TableOfContents({ data }: Props) {
  // Approximate page numbers. Final could compute via two-pass render but
  // for v1 we estimate based on counts.
  const entries: TocEntry[] = [
    { label: "Lời nói đầu", page: 3 },
    { label: "Mục lục", page: 5 },
    { label: "Sơ đồ phả hệ", page: 6 },
    { label: "Tiểu sử thành viên", page: 7 },
    { label: "Album ảnh", page: 7 + data.members.length * 2 },
    { label: "Truyền thống", page: 9 + data.members.length * 2 + Math.ceil(data.photos.length / 6) },
    { label: "Lời dặn", page: 10 + data.members.length * 2 + Math.ceil(data.photos.length / 6) + data.traditions.length },
    { label: "Lịch giỗ", page: 12 + data.members.length * 2 + Math.ceil(data.photos.length / 6) + data.traditions.length + Math.ceil(data.quotes.length / 4) },
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Mục lục</Text>
      <Text style={[styles.display, { fontSize: 24, marginBottom: 24 }]}>Mục lục</Text>

      <View style={{ gap: 10 }}>
        {entries.map((e) => (
          <View key={e.label} style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ ...styles.bodySerif, fontSize: 12, color: COLORS.ink }}>{e.label}</Text>
            <View style={{ flex: 1, marginHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border, borderStyle: "dotted", marginBottom: 3 }} />
            <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.ink2 }}>{e.page}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
