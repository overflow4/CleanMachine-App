import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";

export default function CustomersLayout() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Customers" }} />
      <Stack.Screen name="[id]" options={{ title: "Customer Details" }} />
    </Stack>
  );
}
