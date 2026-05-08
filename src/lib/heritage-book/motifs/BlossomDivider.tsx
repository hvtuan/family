import { Svg, Path, View } from "@react-pdf/renderer";
import { COLORS } from "../styles";

export function BlossomDivider() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14, justifyContent: "center" }}>
      <View style={{ height: 1, width: 60, backgroundColor: COLORS.gold2, opacity: 0.5 }} />
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path
          d="M12 2 C 14 6, 18 8, 22 12 C 18 16, 14 18, 12 22 C 10 18, 6 16, 2 12 C 6 8, 10 6, 12 2 Z"
          fill={COLORS.gold2}
          opacity={0.7}
        />
      </Svg>
      <View style={{ height: 1, width: 60, backgroundColor: COLORS.gold2, opacity: 0.5 }} />
    </View>
  );
}
