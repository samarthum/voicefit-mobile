import Svg, { Circle as SvgCircle } from "react-native-svg";
import { COLORS } from "@/components/command-center";

function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, current / goal));
}

type Props = { current: number; goal: number };

export function MiniStepsRing({ current, goal }: Props) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = progressPercent(current, goal);

  return (
    <Svg width={size} height={size}>
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.ringTrack} strokeWidth={stroke} fill="none" />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={COLORS.steps}
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
