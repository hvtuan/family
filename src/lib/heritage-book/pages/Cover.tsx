import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { LotusSeal } from "../motifs/LotusSeal";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function Cover({ data }: Props) {
  return (
    <Page size="A4" style={[styles.page, { padding: 0, backgroundColor: COLORS.cream }]}>
      <View style={{
        flex: 1, justifyContent: "space-between", alignItems: "center",
        padding: 56, borderWidth: 1.5, borderColor: COLORS.gold2, margin: 20,
      }}>
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.gold2, letterSpacing: 4, textTransform: "uppercase" }}>
            Gia Phả · Genealogy
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 18 }}>
          <LotusSeal size={140} />
          <Text style={{ fontFamily: "DancingScript", fontSize: 78, color: COLORS.gold2, lineHeight: 0.95 }}>
            Họ {data.surname}
          </Text>
          <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 14, color: COLORS.ink2, textAlign: "center", maxWidth: 320 }}>
            "{data.motto}"
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 10, color: COLORS.ink3, letterSpacing: 1 }}>
            {data.hometown}
          </Text>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 10, color: COLORS.ink3, fontWeight: 600 }}>
            {data.established} — {data.publicationYear}
          </Text>
        </View>
      </View>
    </Page>
  );
}
