import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { PhotoData } from "@/lib/content";

interface Props { photos: PhotoData[]; }

export function PhotoMosaic({ photos }: Props) {
  // Group 6 per page
  const pages: PhotoData[][] = [];
  for (let i = 0; i < photos.length; i += 6) {
    pages.push(photos.slice(i, i + 6));
  }

  return (
    <>
      {pages.map((batch, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.kicker}>Album · Trang {idx + 1}/{pages.length}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {batch.map((p, i) => (
              <View key={i} style={{ width: "32%", marginBottom: 12 }}>
                <Image src={p.src} style={{ width: "100%", height: 130, objectFit: "cover", opacity: 0.95 }} />
                <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 8, color: COLORS.ink3, marginTop: 4 }}>
                  {p.caption || "—"}
                  {p.year ? ` · ${p.year}` : ""}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
    </>
  );
}
