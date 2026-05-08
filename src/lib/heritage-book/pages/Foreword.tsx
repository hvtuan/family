import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function Foreword({ data }: Props) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Lời nói đầu</Text>
      <Text style={styles.display}>{data.brand.vi}</Text>

      <View style={{ marginTop: 28, marginBottom: 14 }}>
        <Text style={{ ...styles.bodySerif, fontStyle: "italic", fontSize: 16, color: COLORS.ink2, textAlign: "center" }}>
          "{data.motto}"
        </Text>
      </View>

      <BlossomDivider />

      <View style={{ marginTop: 18, gap: 12 }}>
        <Text style={styles.bodySerif}>
          Cuốn sách này tổng hợp thông tin về {data.members.length} thành viên dòng họ, từ {data.established}{" "}
          đến nay. Quê hương: {data.hometown}.
        </Text>
        <Text style={styles.bodySerif}>
          Mọi thông tin được giữ và cập nhật online tại family.huynhvantuan.net. Phiên bản giấy này
          được phát hành nhằm lưu giữ và chia sẻ trong gia đình — đặt trên bàn thờ, mang đi đám giỗ,
          làm quà cho con cháu xa quê.
        </Text>
        <Text style={styles.bodySerif}>
          Nguồn ảnh, ngày tháng, ngày giỗ, lời dặn — tất cả do gia đình tự thu thập. Có thể có sai sót,
          xin các cô chú bổ sung qua admin website.
        </Text>
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
