import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { Stack, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Sidebar } from "@/components/Sidebar";
import { Theme } from "@/constants/colors";

const DRAWER_WIDTH = 280;

const screenTitles: Record<string, string> = {
  overview: "Command Center",
  customers: "Customers",
  calendar: "Calendar",
  leads: "Pipeline",
  teams: "Teams",
  schedule: "Schedule",
  insights: "Insights",
  assistant: "Assistant",
  inbox: "Inbox",
  campaigns: "Campaigns",
  earnings: "Earnings",
  admin: "Admin",
  quotes: "Quotes",
  crews: "Crew Assignment",
  memberships: "Memberships",
  leaderboard: "Leaderboard",
  "rain-day": "Rain Day",
  calls: "Calls",
  exceptions: "Exceptions",
  retargeting: "Retargeting",
  settings: "Settings",
};

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const translateX = useSharedValue(-DRAWER_WIDTH);

  const openDrawer = () => {
    setDrawerOpen(true);
    translateX.value = withTiming(0, { duration: 200 });
  };

  const closeDrawer = () => {
    translateX.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
    setTimeout(() => setDrawerOpen(false), 200);
  };

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Get current screen title
  const pathSegments = pathname.split("/").filter(Boolean);
  const currentScreen = pathSegments[pathSegments.length - 1] || "overview";
  const title = screenTitles[currentScreen] || currentScreen;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Nav */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.menuButton}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color={Theme.foreground} />
        </TouchableOpacity>

        <Text style={styles.topNavTitle} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.topNavRight}>
          {/* Status indicator */}
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Theme.background },
            animation: "fade",
          }}
        >
          <Stack.Screen name="overview" />
          <Stack.Screen name="customers" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="leads" />
          <Stack.Screen name="teams" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="assistant" />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="campaigns" />
          <Stack.Screen name="earnings" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="quotes" />
          <Stack.Screen name="crews" />
          <Stack.Screen name="memberships" />
          <Stack.Screen name="leaderboard" />
          <Stack.Screen name="rain-day" />
          <Stack.Screen name="calls" />
          <Stack.Screen name="exceptions" />
          <Stack.Screen name="retargeting" />
          <Stack.Screen name="settings" />
        </Stack>
      </View>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={styles.overlay}
            onPress={closeDrawer}
          />
          <Animated.View style={[styles.drawer, drawerStyle]}>
            <Sidebar onClose={closeDrawer} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  topNav: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: "rgba(30,28,36,0.8)", // card/80
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  topNavTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  topNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  statusText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 50,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    zIndex: 51,
  },
});
