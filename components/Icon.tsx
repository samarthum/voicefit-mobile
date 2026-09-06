/** One outline icon family across iOS, Android and web.
 * Keep semantic names here so screens never choose platform-specific glyphs.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { color as tokens } from "@/lib/tokens";

export const ICON_NAMES = {
  chevronRight: "chevron-forward",
  chevronLeft: "chevron-back",
  chevronUp: "chevron-up",
  chevronDown: "chevron-down",
  back: "arrow-back",
  forward: "arrow-forward",
  arrowUp: "arrow-up",
  arrowDown: "arrow-down",
  close: "close",
  plus: "add",
  check: "checkmark",
  checkCircle: "checkmark-circle-outline",
  play: "play",
  pause: "pause",
  stop: "stop",
  trash: "trash-outline",
  edit: "create-outline",
  share: "share-outline",
  ellipsisVertical: "ellipsis-horizontal",
  ellipsisHorizontal: "ellipsis-horizontal",
  mic: "mic-outline",
  micOff: "mic-off-outline",
  send: "arrow-up",
  sparkSend: "arrow-up",
  search: "search-outline",
  keyboard: "keypad-outline",
  camera: "camera-outline",
  image: "image-outline",
  eye: "eye-outline",
  eyeOff: "eye-off-outline",
  sparkle: "sparkles-outline",
  sparkleInk: "sparkles-outline",
  robot: "sparkles-outline",
  flame: "flame-outline",
  heart: "heart-outline",
  heartFill: "heart",
  dumbbell: "barbell-outline",
  figure: "walk-outline",
  trendUp: "trending-up",
  trendDown: "trending-down",
  weight: "scale-outline",
  calendar: "calendar-outline",
  clock: "time-outline",
  bell: "notifications-outline",
  bellFill: "notifications",
  settings: "settings-outline",
  sliders: "options-outline",
  person: "person-outline",
  personFill: "person",
  personCircle: "person-circle-outline",
  home: "home-outline",
  homeFill: "home",
  barChart: "stats-chart-outline",
  listBullet: "list-outline",
  doc: "document-text-outline",
  warning: "warning-outline",
  info: "information-circle-outline",
  error: "close-circle-outline",
  units: "resize-outline",
  link: "link-outline",
  externalLink: "open-outline",
  pulseDot: "ellipse",
} as const satisfies Record<string, ComponentProps<typeof Ionicons>["name"]>;
export type IconName = keyof typeof ICON_NAMES;

export function Icon({ name, size = 20, color = tokens.text }: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={ICON_NAMES[name]} size={size} color={color} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
