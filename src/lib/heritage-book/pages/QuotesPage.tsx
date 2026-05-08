import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { QuoteEntry } from "@/lib/content";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  quotes: QuoteEntry[];
  members: ClientMember[];
}

export function QuotesPage({ quotes, members }: Props) {
  const memberById = new Map(members.map((m) => [m.id, m]));

  const pages: QuoteEntry[][] = [];
  for (let i = 0; i < quotes.length; i += 4) {
    pages.push(quotes.slice(i, i + 4));
  }

  return (
    <>
      {pages.map((batch, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.kicker}>Lời dặn · {idx + 1}/{pages.length}</Text>

          <View style={{ flex: 1, justifyContent: "space-around", gap: 18, marginTop: 10 }}>
            {batch.map((q) => {
              const author = q.data.authorRef ? memberById.get(q.data.authorRef.id) : null;
              return (
                <View key={q.id} style={{ position: "relative", paddingLeft: 24 }}>
                  <Text style={{ position: "absolute", left: 0, top: -10, fontFamily: "Lora", fontSize: 32, color: COLORS.vermilion, opacity: 0.4 }}>
                    "
                  </Text>
                  <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 13, color: COLORS.ink, lineHeight: 1.55 }}>
                    {q.data.text}
                  </Text>
                  <Text style={{ fontFamily: "BeVietnamPro", fontSize: 9, color: COLORS.ink2, marginTop: 6, fontWeight: 600 }}>
                    — {q.data.author}{author ? ` · Đời ${author.gen}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
    </>
  );
}
