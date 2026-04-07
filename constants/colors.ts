// Dark theme — exact oklch-to-hex conversions from web app globals.css

export const Theme = {
  // Page backgrounds (near-black, extremely subtle differences)
  background: "#030304", // oklch(0.098 0.005 270)
  sidebar: "#040406", // oklch(0.11 0.005 270)
  card: "#070709", // oklch(0.13 0.005 270)
  popover: "#0a0b0d", // oklch(0.15 0.005 270)
  muted: "#111114", // oklch(0.18 0.005 270)
  input: "#111114", // same as muted

  // Borders
  border: "#191a1f", // oklch(0.22 0.01 270)
  borderLight: "rgba(255,255,255,0.06)",
  borderSubtle: "rgba(255,255,255,0.04)",
  sidebarBorder: "#14161b", // oklch(0.2 0.01 270)
  secondary: "#14161b", // oklch(0.2 0.01 270)

  // Text
  foreground: "#eeeeee", // oklch(0.95 0 0)
  mutedForeground: "#808080", // oklch(0.6 0 0)
  cardForeground: "#eeeeee",

  // Primary — VIVID BLUE (not purple!)
  primary: "#0091ff", // oklch(0.65 0.2 250)
  primaryLight: "#38a3ff", // lighter variant
  primaryDark: "#0080e0",
  primaryMuted: "rgba(0,145,255,0.15)", // bg-primary/15
  primaryForeground: "#f8f8f8",

  // Accent — teal/cyan
  accent: "#008d9b", // oklch(0.55 0.18 200)

  // Status colors
  success: "#45ba50", // oklch(0.7 0.18 145)
  successBg: "rgba(69,186,80,0.1)",
  successForeground: "#0b0b0b",
  warning: "#eab532", // oklch(0.8 0.15 85)
  warningBg: "rgba(234,181,50,0.1)",
  warningForeground: "#0b0b0b",
  destructive: "#d40924", // oklch(0.55 0.22 25)
  destructiveBg: "rgba(212,9,36,0.1)",
  info: "#0091ff", // same as primary
  infoBg: "rgba(0,145,255,0.1)",

  // Web app uses these Tailwind colors in hardcoded classes
  violet300: "#c4b5fd",
  violet400: "#a78bfa",
  violet600: "#7c3aed",
  purple400: "#c084fc",
  emerald400: "#34d399",
  amber400: "#fbbf24",
  red400: "#f87171",
  red500: "#ef4444",
  blue400: "#60a5fa",
  pink500: "#ec4899",
  cyan400: "#22d3ee",
  teal400: "#2dd4bf",

  // Zinc shades
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",

  // Glass card (from globals.css .glass-card)
  glassCard: "rgba(24,24,27,0.6)",
  glassCardBorder: "rgba(255,255,255,0.06)",
  glassListItem: "rgba(39,39,42,0.25)",
  glassListItemHover: "rgba(39,39,42,0.45)",
};

// Sidebar nav — web uses purple-400 for active icons but primary blue for borders
export const NavColors = {
  activeBg: "rgba(255,255,255,0.06)",
  activeText: "#eeeeee",
  activeIcon: "#0091ff", // primary blue
  activeBorder: "#0091ff",
  inactiveText: "#808080",
  hoverBg: "rgba(255,255,255,0.03)",
};
