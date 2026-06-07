/**
 * Icon.tsx — Cross-platform icon component (NUI-11)
 *
 * Renders an SF Symbol on iOS and a MaterialIcons glyph on Android / web so a
 * glyph is never blank on any platform.
 *
 * Usage:
 *   <Icon name="chevronRight" size={16} color={token.textMute} />
 *
 * To add a new glyph: add an entry to MAP with both `sf` and `md` values.
 * Every `md` value must be a real MaterialIcons name (strict union).
 */

import { SymbolView, type SymbolViewProps } from "expo-symbols";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { color as tokens } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Name map: semantic glyph name → platform-specific icon identifiers
// ---------------------------------------------------------------------------

const MAP = {
  // Navigation
  chevronRight:       { sf: "chevron.right",              md: "chevron-right" },
  chevronLeft:        { sf: "chevron.left",               md: "chevron-left" },
  chevronUp:          { sf: "chevron.up",                 md: "expand-less" },
  chevronDown:        { sf: "chevron.down",               md: "expand-more" },
  back:               { sf: "arrow.backward",             md: "arrow-back" },
  forward:            { sf: "arrow.forward",              md: "arrow-forward" },
  arrowUp:            { sf: "arrow.up",                   md: "arrow-upward" },
  arrowDown:          { sf: "arrow.down",                 md: "arrow-downward" },

  // Actions / UI controls
  close:              { sf: "xmark",                      md: "close" },
  plus:               { sf: "plus",                       md: "add" },
  check:              { sf: "checkmark",                  md: "check" },
  checkCircle:        { sf: "checkmark.circle",           md: "check-circle-outline" },
  play:               { sf: "play.fill",                  md: "play-arrow" },
  pause:              { sf: "pause.fill",                 md: "pause" },
  stop:               { sf: "stop.fill",                  md: "stop" },
  trash:              { sf: "trash",                      md: "delete-outline" },
  edit:               { sf: "pencil",                     md: "edit" },
  share:              { sf: "square.and.arrow.up",        md: "ios-share" },
  ellipsisVertical:   { sf: "ellipsis",                   md: "more-vert" },
  ellipsisHorizontal: { sf: "ellipsis",                   md: "more-horiz" },

  // Input
  mic:                { sf: "mic",                        md: "mic" },
  micOff:             { sf: "mic.slash",                  md: "mic-off" },
  send:               { sf: "arrow.up.circle.fill",       md: "send" },
  sparkSend:          { sf: "paperplane",                 md: "send" },
  search:             { sf: "magnifyingglass",            md: "search" },
  keyboard:           { sf: "keyboard",                   md: "keyboard" },

  // Media / capture
  camera:             { sf: "camera",                     md: "photo-camera" },
  image:              { sf: "photo",                      md: "image" },
  eye:                { sf: "eye",                        md: "visibility" },
  eyeOff:             { sf: "eye.slash",                  md: "visibility-off" },

  // AI / Coach
  sparkle:            { sf: "sparkles",                   md: "auto-awesome" },
  sparkleInk:         { sf: "sparkles",                   md: "auto-awesome" },
  robot:              { sf: "brain.head.profile",         md: "smart-toy" },

  // Health & fitness
  flame:              { sf: "flame",                      md: "local-fire-department" },
  heart:              { sf: "heart",                      md: "favorite-border" },
  heartFill:          { sf: "heart.fill",                 md: "favorite" },
  dumbbell:           { sf: "dumbbell",                   md: "fitness-center" },
  figure:             { sf: "figure.walk",                md: "directions-walk" },
  trendUp:            { sf: "chart.line.uptrend.xyaxis",  md: "trending-up" },
  trendDown:          { sf: "chart.line.downtrend.xyaxis",md: "trending-down" },
  weight:             { sf: "scalemass",                  md: "monitor-weight" },

  // Calendar / time
  calendar:           { sf: "calendar",                   md: "calendar-today" },
  clock:              { sf: "clock",                      md: "schedule" },

  // Notifications & settings
  bell:               { sf: "bell",                       md: "notifications-none" },
  bellFill:           { sf: "bell.fill",                  md: "notifications" },
  settings:           { sf: "gearshape",                  md: "settings" },
  sliders:            { sf: "slider.horizontal.3",        md: "tune" },

  // Person / profile
  person:             { sf: "person",                     md: "person-outline" },
  personFill:         { sf: "person.fill",                md: "person" },
  personCircle:       { sf: "person.circle",              md: "account-circle" },

  // Tab bar
  home:               { sf: "house",                      md: "home" },
  homeFill:           { sf: "house.fill",                 md: "home" },
  barChart:           { sf: "chart.bar",                  md: "bar-chart" },
  listBullet:         { sf: "list.bullet",                md: "format-list-bulleted" },
  doc:                { sf: "doc.text",                   md: "article" },

  // Status / info
  warning:            { sf: "exclamationmark.triangle",   md: "warning-amber" },
  info:               { sf: "info.circle",                md: "info-outline" },
  error:              { sf: "xmark.circle",               md: "error-outline" },

  // Misc
  units:              { sf: "ruler",                      md: "straighten" },
  link:               { sf: "link",                       md: "link" },
  externalLink:       { sf: "arrow.up.right.square",      md: "open-in-new" },
  pulseDot:           { sf: "circle.fill",                md: "fiber-manual-record" },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IconName = keyof typeof MAP;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Icon({
  name,
  size = 20,
  color = tokens.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const g = MAP[name];
  if (process.env.EXPO_OS === "ios") {
    return (
      <SymbolView
        name={g.sf as SymbolViewProps["name"]}
        size={size}
        tintColor={color}
      />
    );
  }
  return <MaterialIcons name={g.md} size={size} color={color} />;
}
