import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { LotusSeal } from "../motifs/LotusSeal";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function BackCover({ data }: Props) {
  return (
    <Page size="A4" style={[styles.page, { padding: 0, backgroundColor: COLORS.cream }]}>
      <View style={{
        flex: 1, justifyContent: "center", alignItems: "center",
        padding: 56, gap: 28,
      }}>
        <LotusSeal size={120} surname={data.surname} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 12, color: COLORS.ink3 }}>
            Cập nhật trực tuyến tại
          </Text>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.gold2, letterSpacing: 1.2 }}>
            family.huynhvantuan.net
          </Text>
        </View>
        <Text style={{ position: "absolute", bottom: 48, fontSize: 9, color: COLORS.ink3, letterSpacing: 1 }}>
          Phát hành {data.publicationYear}
        </Text>
      </View>
    </Page>
  );
}
