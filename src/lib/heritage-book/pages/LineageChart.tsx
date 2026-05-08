import { Page, Text, View, Svg, G, Rect, Line, Text as SvgText } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { ClientMember } from "@/lib/members-client";

interface Props { members: ClientMember[]; }

export function LineageChart({ members }: Props) {
  if (members.length === 0) {
    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Sơ đồ phả hệ</Text>
        <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>Cây gia phả</Text>
        <Text style={[styles.bodySerif, { fontSize: 11, color: COLORS.ink3, textAlign: "center", marginTop: 40 }]}>
          Chưa có dữ liệu thành viên.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>
    );
  }

  // Group by generation
  const byGen = new Map<number, ClientMember[]>();
  for (const m of members) {
    if (!byGen.has(m.gen)) byGen.set(m.gen, []);
    byGen.get(m.gen)!.push(m);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);

  const PAGE_W = 595; // A4 width pt
  const CHART_W = PAGE_W - 96; // 48pt padding each side
  const CHART_H = 660;
  const ROW_H = CHART_H / Math.max(generations.length, 1);
  const BOX_W = 100;
  const BOX_H = 32;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Sơ đồ phả hệ</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>Cây gia phả</Text>

      <View>
        <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          {generations.map((gen, rowIdx) => {
            const rowMembers = byGen.get(gen)!;
            const colWidth = CHART_W / Math.max(rowMembers.length, 1);
            const y = rowIdx * ROW_H + ROW_H / 2;

            // Connector lines from this row to next row
            const nextGen = generations[rowIdx + 1];
            const nextRowMembers = nextGen !== undefined ? byGen.get(nextGen)! : null;
            const nextColWidth = nextRowMembers ? CHART_W / Math.max(nextRowMembers.length, 1) : 0;
            const nextY = (rowIdx + 1) * ROW_H + ROW_H / 2;

            return (
              <G key={`row-${gen}`}>
                {/* Connector lines to next generation */}
                {nextRowMembers && rowMembers.map((_, ci) => {
                  const x1 = ci * colWidth + colWidth / 2;
                  const x2 = ci * nextColWidth + nextColWidth / 2;
                  return (
                    <Line
                      key={`line-${gen}-${ci}`}
                      x1={x1}
                      y1={y + BOX_H / 2}
                      x2={x2}
                      y2={nextY - BOX_H / 2}
                      stroke={COLORS.gold2}
                      strokeWidth={0.4}
                      opacity={0.5}
                    />
                  );
                })}

                {/* Member boxes */}
                {rowMembers.map((m, colIdx) => {
                  const x = colIdx * colWidth + colWidth / 2;
                  const displayName = m.name.length > 14 ? m.name.slice(0, 14) + "…" : m.name;
                  return (
                    <G key={m.id}>
                      <Rect
                        x={x - BOX_W / 2}
                        y={y - BOX_H / 2}
                        width={BOX_W}
                        height={BOX_H}
                        stroke={COLORS.gold2}
                        strokeWidth={0.7}
                        fill="transparent"
                        rx={2}
                        ry={2}
                      />
                      <SvgText
                        x={x}
                        y={y - 2}
                        textAnchor="middle"
                        style={{ fontSize: 8, fill: COLORS.ink }}
                      >
                        {displayName}
                      </SvgText>
                      <SvgText
                        x={x}
                        y={y + 10}
                        textAnchor="middle"
                        style={{ fontSize: 6, fill: COLORS.ink3 }}
                      >
                        {`Doi ${m.gen}`}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            );
          })}
        </Svg>
      </View>

      <Text style={[styles.bodySerif, { fontSize: 9, color: COLORS.ink3, marginTop: 14, textAlign: "center" }]}>
        Sơ đồ tóm tắt — chi tiết tiểu sử xem các trang sau
      </Text>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
