import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import type { TraditionEntry } from "@/lib/content";

interface Props { tradition: TraditionEntry; }

function safeText(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function TraditionPage({ tradition }: Props) {
  const data = tradition.data;
  const body = safeText(tradition.body || data.desc || "");
  const truncated = body.length > 1100 ? body.slice(0, 1100) + "..." : body;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Truyền thống · {data.category}</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>{data.name}</Text>

      {data.image && (
        <View style={{ height: 180, marginBottom: 14 }}>
          <Image src={data.image} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 }} />
        </View>
      )}

      <Text style={[styles.bodySerif, { textAlign: "justify" }]}>{truncated}</Text>

      {data.tags && data.tags.length > 0 && (
        <>
          <BlossomDivider />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {data.tags.slice(0, 8).map((t) => (
              <Text key={t} style={{ fontSize: 8, color: COLORS.ink3, borderWidth: 0.5, borderColor: COLORS.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                {t}
              </Text>
            ))}
          </View>
        </>
      )}

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
