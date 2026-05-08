import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import { formatLunarVi, solarToLunar } from "@/lib/lunar";
import type { ClientMember } from "@/lib/members-client";
import type { QuoteEntry } from "@/lib/content";

interface Props {
  member: ClientMember;
  quotes: QuoteEntry[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function safeText(s: string): string {
  // Strip HTML tags from rendered markdown so PDF Text doesn't break
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function MemberSpread({ member, quotes }: Props) {
  const memberQuotes = quotes.filter((q) => q.data.authorRef?.id === member.id);
  const lunarBorn = member.born ? formatLunarVi(solarToLunar(new Date(member.born))) : null;
  const lunarDied = member.died ? formatLunarVi(solarToLunar(new Date(member.died))) : null;

  const bioText = safeText(member.bio || "");
  const truncatedBio = bioText.length > 700 ? bioText.slice(0, 700) + "..." : bioText;

  return (
    <>
      {/* Left page: portrait + identity */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Đời thứ {member.gen}</Text>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          {member.photo ? (
            <View style={{ width: 240, height: 300, borderWidth: 1, borderColor: COLORS.gold2, opacity: 0.95 }}>
              <Image src={member.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          ) : (
            <View style={{ width: 240, height: 300, borderWidth: 1, borderColor: COLORS.gold2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cream }}>
              <Text style={{ fontFamily: "Lora", fontSize: 80, color: COLORS.gold2, opacity: 0.4 }}>
                {member.name.slice(0, 1)}
              </Text>
            </View>
          )}

          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 26, color: COLORS.ink, textAlign: "center" }}>
              {member.name}
            </Text>
            {member.role && (
              <Text style={{ fontSize: 10, color: COLORS.ink2, letterSpacing: 1 }}>
                {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
              </Text>
            )}
          </View>

          <View style={{ alignItems: "center", gap: 4, marginTop: 10 }}>
            <Text style={{ fontSize: 10, color: COLORS.ink2 }}>
              Sinh: {formatDate(member.born)}
            </Text>
            {lunarBorn && <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic" }}>{lunarBorn}</Text>}
            {member.died && (
              <>
                <Text style={{ fontSize: 10, color: COLORS.ink2, marginTop: 4 }}>
                  Mất: {formatDate(member.died)}
                </Text>
                {lunarDied && <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic" }}>{lunarDied}</Text>}
              </>
            )}
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Right page: bio + lời dặn */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Tiểu sử</Text>
        <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>{member.name}</Text>

        {truncatedBio && (
          <Text style={[styles.bodySerif, { textAlign: "justify" }]}>
            {truncatedBio}
          </Text>
        )}

        {memberQuotes.length > 0 && (
          <>
            <BlossomDivider />
            <Text style={[styles.kicker, { marginTop: 0 }]}>Lời dặn</Text>
            {memberQuotes.slice(0, 2).map((q) => (
              <View key={q.id} style={[styles.blockquote, { marginVertical: 8 }]}>
                <Text style={[styles.bodySerif, { fontStyle: "italic", fontSize: 11 }]}>
                  "{q.data.text}"
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>
    </>
  );
}
