import { useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}
