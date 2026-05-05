// VoiceFit Mobile · Design Tokens · v2.0 (Bevel-light)
// Canonical source of truth for all visual styling. Anything visual that isn't
// here is a bug — flag and add. Inspired by bevel.health: off-white canvas,
// soft white cards, sage accent, deep cool-charcoal text.

export const color = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surface2: "#F1F3F7",
  line: "rgba(15,20,25,0.06)",
  line2: "rgba(15,20,25,0.10)",

  text: "#0F1419",
  textSoft: "#5A6471",
  textMute: "#9AA0AB",

  accent: "#5E8C7A",
  accentDim: "#3F6957",
  accentInk: "#FFFFFF",
  accentTintBg: "rgba(94,140,122,0.08)",
  accentTintBorder: "rgba(94,140,122,0.25)",
  accentRingTrack: "rgba(94,140,122,0.14)",

  positive: "#34A853",
  warn: "#E8924B",
  negative: "#D9534F",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xl2: 32,
  xl3: 44,
  xl4: 56,
} as const;

export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  sheet: 28,
  pill: 9999,
} as const;

// React Native does not support cubic-bezier strings — these mirror the named
// curves so callers can request them by name and pick the right Easing on RN
// or pass the bezier string on web.
export const motion = {
  ease: {
    std: { x1: 0.2, y1: 0.9, x2: 0.3, y2: 1 },
    snap: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
    emph: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
    exit: { x1: 0.4, y1: 0, x2: 1, y2: 1 },
  },
  dur: { quick: 120, base: 260, expr: 420 } as const,
} as const;

// Typography — Inter Tight for everything human, Geist Mono for numerals
// and micro-labels. Loaded via expo-font in app/_layout.tsx.
// Font family names match the keys passed to useFonts() in app/_layout.tsx —
// these are the exact strings RN looks up after the font loader registers the
// .ttf with the system. Falls back to system sans/mono pre-load.
export const font = {
  sans: {
    300: "InterTight_300Light",
    400: "InterTight_400Regular",
    500: "InterTight_500Medium",
    600: "InterTight_600SemiBold",
    700: "InterTight_700Bold",
    800: "InterTight_800ExtraBold",
  },
  mono: {
    400: "GeistMono_400Regular",
    500: "GeistMono_500Medium",
    600: "GeistMono_600SemiBold",
  },
} as const;

// Pre-baked type styles. RN letterSpacing is in points, not em — values below
// were derived from the Tokens.html percentages: ls = fontSize × percentage.
export const type = {
  display: { fontFamily: font.sans[700], fontSize: 64, fontWeight: "700" as const, lineHeight: 65, letterSpacing: -2.56 },
  titleL: { fontFamily: font.sans[600], fontSize: 36, fontWeight: "600" as const, lineHeight: 40, letterSpacing: -1.08 },
  titleM: { fontFamily: font.sans[600], fontSize: 26, fontWeight: "600" as const, lineHeight: 31, letterSpacing: -0.65 },
  titleS: { fontFamily: font.sans[600], fontSize: 18, fontWeight: "600" as const, lineHeight: 24, letterSpacing: -0.27 },
  body: { fontFamily: font.sans[400], fontSize: 14.5, fontWeight: "400" as const, lineHeight: 22, letterSpacing: -0.07 },
  bodyMedium: { fontFamily: font.sans[500], fontSize: 14.5, fontWeight: "500" as const, lineHeight: 22, letterSpacing: -0.07 },
  label: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600" as const,
    lineHeight: 11,
    letterSpacing: 1.68,
    textTransform: "uppercase" as const,
  },
  numXL: { fontFamily: font.mono[500], fontSize: 58, fontWeight: "500" as const, lineHeight: 58, letterSpacing: -2.61 },
  numL: { fontFamily: font.mono[500], fontSize: 38, fontWeight: "500" as const, lineHeight: 38, letterSpacing: -1.52 },
  numM: { fontFamily: font.mono[500], fontSize: 26, fontWeight: "500" as const, lineHeight: 26, letterSpacing: -0.78 },
  numS: { fontFamily: font.mono[500], fontSize: 16, fontWeight: "500" as const, lineHeight: 16, letterSpacing: -0.32 },
  numXS: { fontFamily: font.mono[400], fontSize: 11, fontWeight: "400" as const, lineHeight: 14, letterSpacing: 0 },
} as const;

// Shadows tuned for a light canvas — neutral charcoal, low opacity.
export const elevation = {
  flat: { borderColor: color.line, borderWidth: 1 },
  sheet: {
    borderColor: color.line,
    borderWidth: 1,
    shadowColor: "#0F1419",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryCTA: {
    shadowColor: "#0F1419",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  accentGlow: {
    shadowColor: color.accent,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
} as const;

export type ColorToken = keyof typeof color;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
