import { Svg, Path, G, Text, View } from "@react-pdf/renderer";
import { COLORS } from "../styles";

interface Props { size?: number; surname?: string; }

export function LotusSeal({ size = 80, surname }: Props) {
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G fill={COLORS.gold2} opacity={0.85}>
          <Path d="M50 20 C 40 30, 35 45, 35 55 C 35 60, 38 65, 50 65 C 62 65, 65 60, 65 55 C 65 45, 60 30, 50 20 Z" />
          <Path d="M30 35 C 25 45, 25 55, 30 60 C 35 62, 40 60, 42 55 C 38 48, 32 40, 30 35 Z" />
          <Path d="M70 35 C 75 45, 75 55, 70 60 C 65 62, 60 60, 58 55 C 62 48, 68 40, 70 35 Z" />
          <Path d="M50 60 L 50 80" stroke={COLORS.gold2} strokeWidth={2} />
        </G>
      </Svg>
      {surname && (
        <Text style={{ fontFamily: "DancingScript", fontSize: size * 0.28, color: COLORS.gold2, marginTop: 6 }}>
          Họ {surname}
        </Text>
      )}
    </View>
  );
}
