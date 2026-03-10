import { View } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Defs,
} from "react-native-svg";

type MealGlyphKind = "salad" | "oats" | "salmon";

function inferMealKind(description: string): MealGlyphKind {
  const normalized = description.toLowerCase();
  if (normalized.includes("oats")) return "oats";
  if (normalized.includes("salmon") || normalized.includes("rice")) return "salmon";
  return "salad";
}

function SaladGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={0.5} y={0.5} width={27} height={27} rx={8} fill="#F8F8F8" />
      <Path d="M7.2 15.4C8 12.8 10.4 11 13.2 11H14.8C17.6 11 20 12.8 20.8 15.4" fill="#F2F2F5" stroke="#2D2D2D" strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M9.2 10.7C9.2 9.6 10.1 8.7 11.2 8.7C11.8 8.7 12.3 9 12.6 9.4C12.9 8.8 13.6 8.4 14.4 8.4C15.1 8.4 15.8 8.8 16.1 9.4C16.4 9 16.9 8.7 17.5 8.7C18.6 8.7 19.5 9.6 19.5 10.7C19.5 11.7 18.9 12.4 17.6 13H11.1C9.8 12.4 9.2 11.7 9.2 10.7Z" fill="#4FD26C" />
      <Circle cx={11.3} cy={10.5} r={0.85} fill="#FFD84D" />
      <Circle cx={16.8} cy={10.9} r={0.8} fill="#FF875F" />
      <Circle cx={14.1} cy={11.6} r={0.7} fill="#7C4DFF" />
      <Path d="M7.1 15.3H20.9V16.1C20.9 18 19.3 19.6 17.4 19.6H10.6C8.7 19.6 7.1 18 7.1 16.1V15.3Z" fill="#FFFFFF" stroke="#2D2D2D" strokeWidth={1.3} />
    </Svg>
  );
}

function OatsGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={0.5} y={0.5} width={27} height={27} rx={8} fill="#F8F8F8" />
      <Rect x={9.2} y={5.4} width={9.6} height={17.2} rx={2.4} fill="#FFD07A" stroke="#2D2D2D" strokeWidth={1.3} />
      <Path d="M11 8H17" stroke="#FFF6D8" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M11 10.6H17" stroke="#FFF6D8" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M11 13.2H17" stroke="#FFF6D8" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M11 15.8H17" stroke="#FFF6D8" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M11.2 4.7H16.8" stroke="#2D2D2D" strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

function SalmonGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={0.5} y={0.5} width={27} height={27} rx={8} fill="#F8F8F8" />
      <Ellipse cx={14} cy={15.7} rx={7.8} ry={5.2} fill="#F2F2F5" stroke="#2D2D2D" strokeWidth={1.3} />
      <Path d="M9.6 16.7C10.6 13.6 15.1 11.8 18.6 13.1C17.7 15.8 15.2 17.9 12 18.7" fill="#FF9C57" stroke="#2D2D2D" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.4 14.7C12.4 13.6 14.4 13.4 16.6 14.2" stroke="#FFF2EA" strokeWidth={0.95} strokeLinecap="round" />
      <Circle cx={10.1} cy={13.6} r={0.75} fill="#FFFFFF" stroke="#2D2D2D" strokeWidth={0.75} />
      <Circle cx={10.1} cy={13.6} r={0.3} fill="#2D2D2D" />
      <Ellipse cx={12.2} cy={17.9} rx={4.5} ry={1.2} fill="#EDEDF1" />
    </Svg>
  );
}

export function MealGlyph({ description }: { description: string }) {
  const kind = inferMealKind(description);

  return (
    <View>
      {kind === "oats" ? <OatsGlyph /> : null}
      {kind === "salmon" ? <SalmonGlyph /> : null}
      {kind === "salad" ? <SaladGlyph /> : null}
    </View>
  );
}
