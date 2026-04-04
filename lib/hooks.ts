import { Theme } from "@/constants/colors";

export function useThemeColors() {
  // App uses a single dark theme — no light mode variant
  return Theme;
}
