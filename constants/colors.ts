// Dark glassmorphism theme matching web app exactly
// All colors derived from oklch values in the web app's globals.css

export const Theme = {
  // Page backgrounds
  background: "#141318", // oklch(0.098 0.005 270)
  sidebar: "#1a1820", // oklch(0.11 0.005 270)
  card: "#1e1c24", // oklch(0.13 0.005 270)
  cardHover: "#24222c", // slightly lighter card
  popover: "#232130", // oklch(0.15 0.005 270)
  muted: "#272530", // oklch(0.18 0.005 270)
  input: "#272530", // same as muted

  // Borders
  border: "#322f3d", // oklch(0.22 0.01 270)
  borderLight: "rgba(255,255,255,0.06)",
  borderSubtle: "rgba(255,255,255,0.04)",
  sidebarBorder: "#2e2b38", // oklch(0.2 0.01 270)

  // Text
  foreground: "#f0eff2", // oklch(0.95 0 0)
  mutedForeground: "#908e96", // oklch(0.6 0 0)
  cardForeground: "#f0eff2",

  // Primary purple/violet accent
  primary: "#7c6cfa", // oklch(0.65 0.2 250) — vibrant purple
  primaryLight: "#a78bfa", // violet-400
  primaryDark: "#6d5de0",
  primaryMuted: "rgba(124,108,250,0.15)", // bg-primary/15

  // Specific accent colors
  violet300: "#c4b5fd",
  violet400: "#a78bfa",
  violet500: "#8b5cf6",
  violet600: "#7c3aed",
  purple400: "#c084fc",
  indigo500: "#6366f1",
  indigo600: "#4f46e5",
  teal400: "#2dd4bf",
  teal500: "#14b8a6",

  // Status colors
  success: "#34d399", // emerald-400
  successBg: "rgba(16,185,129,0.1)",
  warning: "#fbbf24", // amber-400
  warningBg: "rgba(245,158,11,0.1)",
  destructive: "#f87171", // red-400
  destructiveBg: "rgba(239,68,68,0.1)",
  info: "#60a5fa", // blue-400
  infoBg: "rgba(96,165,250,0.1)",

  // Zinc shades (used throughout)
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",

  // Glass card
  glassCard: "rgba(24,24,27,0.6)",
  glassCardBorder: "rgba(255,255,255,0.06)",
  glassListItem: "rgba(39,39,42,0.25)",
  glassListItemHover: "rgba(39,39,42,0.45)",

  // Scrollbar
  scrollThumb: "rgba(113,113,122,0.3)",
};

// Sidebar nav item colors
export const NavColors = {
  activeBg: "rgba(255,255,255,0.06)",
  activeText: "#f0eff2",
  activeIcon: "#c084fc", // purple-400
  activeBorder: "#7c3aed", // violet-600
  inactiveText: "#908e96",
  hoverBg: "rgba(255,255,255,0.03)",
};
