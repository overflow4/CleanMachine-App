import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Pressable,
  Switch,
} from "react-native";
import { Stack, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Sidebar } from "@/components/Sidebar";
import { Theme } from "@/constants/colors";

const DRAWER_WIDTH = 280;
const EDGE_WIDTH = 30; // swipe zone from left edge

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
  const [systemActive, setSystemActive] = useState(true);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const { tenant, refresh } = useAuth();

  // Sync system active from tenant
  useEffect(() => {
    if (tenant?.active !== undefined) {
      setSystemActive(tenant.active);
    }
  }, [tenant?.active]);

  const toggleSystem = useCallback(async (newValue: boolean) => {
    const prev = systemActive;
    setSystemActive(newValue); // optimistic
    try {
      await apiFetch("/api/tenant/status", {
        method: "POST",
        body: JSON.stringify({ active: newValue }),
      });
      refresh().catch(() => {});
    } catch {
      setSystemActive(prev); // rollback
    }
  }, [systemActive, refresh]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    translateX.value = withTiming(0, { duration: 200 });
  }, []);

  const closeDrawer = useCallback(() => {
    translateX.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
    setTimeout(() => setDrawerOpen(false), 200);
  }, []);

  // Swipe-from-left-edge gesture to open drawer
  const panGesture = Gesture.Pan()
    .activeOffsetX(15)
    .failOffsetY([-20, 20])
    .onStart((e) => {
      // Only activate if starting near left edge and drawer is closed
      if (e.x > EDGE_WIDTH) return;
    })
    .onUpdate((e) => {
      if (e.x <= EDGE_WIDTH + e.translationX) {
        const newX = Math.min(0, Math.max(-DRAWER_WIDTH, -DRAWER_WIDTH + e.translationX));
        translateX.value = newX;
      }
    })
    .onEnd((e) => {
      if (e.translationX > DRAWER_WIDTH / 3) {
        translateX.value = withTiming(0, { duration: 150 });
        runOnJS(setDrawerOpen)(true);
      } else {
        translateX.value = withTiming(-DRAWER_WIDTH, { duration: 150 });
        runOnJS(setDrawerOpen)(false);
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: (translateX.value + DRAWER_WIDTH) / DRAWER_WIDTH * 0.6,
  }));

  // Get current screen title — for dynamic routes like /customers/13756,
  // use the parent segment name instead of the numeric ID
  const pathSegments = pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || "overview";
  const isNumericId = /^\d+$/.test(lastSegment);
  const currentScreen = isNumericId
    ? pathSegments[pathSegments.length - 2] || "overview"
    : lastSegment;
  const title = screenTitles[currentScreen] || currentScreen;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
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
              {/* System Active Toggle */}
              <View style={[styles.togglePill, { borderColor: systemActive ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)" }]}>
                <View style={[styles.toggleIconBox, { backgroundColor: systemActive ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
                  <Ionicons
                    name={systemActive ? "power" : "power-outline"}
                    size={14}
                    color={systemActive ? Theme.success : Theme.destructive}
                  />
                </View>
                <Text style={[styles.toggleLabel, { color: systemActive ? Theme.success : Theme.destructive }]}>
                  {systemActive ? "Active" : "Offline"}
                </Text>
                <Switch
                  value={systemActive}
                  onValueChange={toggleSystem}
                  trackColor={{ false: "rgba(212,9,36,0.3)", true: "rgba(69,186,80,0.3)" }}
                  thumbColor={systemActive ? Theme.success : Theme.destructive}
                  style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                />
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Theme.background, paddingTop: 12 },
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
              <Stack.Screen name="assistant" options={{ contentStyle: { backgroundColor: Theme.background, paddingTop: 0 } }} />
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

          {/* Drawer Overlay + Drawer */}
          {drawerOpen && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Pressable style={styles.overlay} onPress={closeDrawer} />
              <Animated.View style={[styles.drawer, drawerStyle]}>
                <Sidebar onClose={closeDrawer} />
              </Animated.View>
            </View>
          )}
          {/* Invisible drawer that follows gesture even when closed (for swipe preview) */}
          {!drawerOpen && (
            <Animated.View style={[styles.drawer, drawerStyle]} pointerEvents="none">
              <Sidebar onClose={closeDrawer} />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  topNav: {
    height: 56, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
    backgroundColor: "rgba(30,28,36,0.8)",
  },
  menuButton: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  topNavTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: Theme.foreground },
  topNavRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  togglePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingLeft: 4, paddingRight: 2, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: "rgba(10,11,13,0.5)",
  },
  toggleIconBox: { padding: 4, borderRadius: 6 },
  toggleLabel: { fontSize: 12, fontWeight: "500" },
  content: { flex: 1, backgroundColor: Theme.background },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)", zIndex: 50,
  },
  drawer: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH, zIndex: 51,
  },
});
