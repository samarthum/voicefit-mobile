// VoiceFit Mobile · Design Tokens · v1.0
// Canonical source of truth — extracted from project Tokens.html (Pulse direction).
// Anything visual that isn't here is a bug — flag and add.

export const color = {
  bg: "#0A0B0A",
  surface: "#141614",
  surface2: "#1C1F1C",
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.14)",

  text: "#F3F4F1",
  textSoft: "rgba(243,244,241,0.68)",
  textMute: "rgba(243,244,241,0.42)",

  accent: "#C7FB41",
  accentDim: "#8AAE2B",
  accentInk: "#0A0B0A",
  accentTintBg: "rgba(199,251,65,0.08)",
  accentTintBorder: "rgba(199,251,65,0.25)",
  accentRingTrack: "rgba(199,251,65,0.12)",

  positive: "#7CE08A",
  warn: "#FFB347",
  negative: "#FF6B6B",
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

// Hairline rules and accent-glow helpers — used by Card / FloatingSheet.
export const elevation = {
  flat: { borderColor: color.line, borderWidth: 1 },
  sheet: {
    borderColor: color.line2,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  primaryCTA: {
    shadowColor: color.accent,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  accentGlow: {
    shadowColor: color.accent,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
} as const;

export type ColorToken = keyof typeof color;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
