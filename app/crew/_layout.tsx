import { Stack } from "expo-router";

export default function CrewLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="job/[jobId]" />
      <Stack.Screen name="estimate/[jobId]" />
      <Stack.Screen name="new-quote/index" />
      <Stack.Screen name="preconfirm/[preconfirmId]" />
    </Stack>
  );
}
