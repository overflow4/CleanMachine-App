import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";

export default function MoreLayout() {
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
      <Stack.Screen name="index" options={{ title: "More" }} />
      <Stack.Screen name="leads" options={{ title: "Leads" }} />
      <Stack.Screen name="assistant" options={{ title: "AI Assistant" }} />
      <Stack.Screen name="inbox" options={{ title: "Inbox" }} />
      <Stack.Screen name="campaigns" options={{ title: "Campaigns" }} />
      <Stack.Screen name="earnings" options={{ title: "Earnings" }} />
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
      <Stack.Screen name="quotes" options={{ title: "Quotes" }} />
      <Stack.Screen name="schedule" options={{ title: "Schedule" }} />
      <Stack.Screen name="crews" options={{ title: "Crews" }} />
      <Stack.Screen name="memberships" options={{ title: "Memberships" }} />
      <Stack.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      <Stack.Screen name="insights" options={{ title: "Insights" }} />
      <Stack.Screen name="rain-day" options={{ title: "Rain Day" }} />
      <Stack.Screen name="calls" options={{ title: "Calls" }} />
      <Stack.Screen name="exceptions" options={{ title: "Exceptions" }} />
      <Stack.Screen name="retargeting" options={{ title: "Retargeting" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
