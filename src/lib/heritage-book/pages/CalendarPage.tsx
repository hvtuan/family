import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { formatLunarVi, solarToLunar } from "@/lib/lunar";
import type { MemorialMember } from "@/lib/memorial";

interface Props { deceased: MemorialMember[]; }

export function CalendarPage({ deceased }: Props) {
  const sorted = deceased
    .filter((m) => m.died)
    .map((m) => {
      const d = new Date(m.died!);
      return {
        member: m,
        month: d.getMonth() + 1,
        day: d.getDate(),
        year: d.getFullYear(),
        lunar: formatLunarVi(solarToLunar(d)),
      };
    })
    .sort((a, b) => a.month - b.month || a.day - b.day);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Lịch giỗ</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 4 }]}>Lịch giỗ trong năm</Text>
      <Text style={[styles.bodySerif, { fontSize: 10, color: COLORS.ink3, marginBottom: 18 }]}>
        Ngày giỗ tổ tiên đã khuất, sắp theo tháng dương lịch
      </Text>

      <View style={{ gap: 10 }}>
        {sorted.map(({ member, month, day, year, lunar }) => (
          <View key={member.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
            <View style={{ width: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.gold2, padding: 6, borderRadius: 4 }}>
              <Text style={{ fontFamily: "BeVietnamPro", fontSize: 18, fontWeight: 600, color: COLORS.ink }}>
                {String(day).padStart(2, "0")}
              </Text>
              <Text style={{ fontFamily: "BeVietnamPro", fontSize: 7, color: COLORS.ink3, letterSpacing: 0.5 }}>
                THÁNG {month}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 13, color: COLORS.ink }}>
                {member.name}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.ink2, marginTop: 2 }}>
                Mất {String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year} · Đời {member.gen}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic", marginTop: 1 }}>
                {lunar}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
