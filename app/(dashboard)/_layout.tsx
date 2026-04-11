import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
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

// --- Search result types ---
interface SearchResult {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  route: string;
}

interface GroupedResults {
  category: string;
  data: SearchResult[];
}

const CATEGORY_ICONS: Record<string, string> = {
  customers: "people-outline",
  messages: "chatbubble-outline",
  calls: "call-outline",
  jobs: "briefcase-outline",
  leads: "trending-up-outline",
};

function searchSnippet(text: string, query: string, maxLen = 100): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? "..." : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 60);
  let snippet = text.slice(start, end).replace(/\n/g, " ");
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet += "...";
  return snippet;
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GroupedResults[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchCacheRef = useRef<{ customers: any[]; conversations: any[]; calls: any[]; leads: any[]; jobs: any[]; ts: number } | null>(null);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
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

  const loadSearchData = useCallback(async () => {
    // Re-use cache if less than 2 min old
    if (searchCacheRef.current && Date.now() - searchCacheRef.current.ts < 120_000) return;
    setSearchLoading(true);
    try {
      const [custRes, convRes, callRes, leadRes, jobRes] = await Promise.allSettled([
        apiFetch("/api/customers"),
        apiFetch("/api/actions/inbox"),
        apiFetch("/api/calls"),
        apiFetch("/api/leads"),
        apiFetch("/api/jobs"),
      ]);
      const val = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : null);
      const cr = val(custRes);
      const cv = val(convRes);
      const ca = val(callRes);
      const lr = val(leadRes);
      const jr = val(jobRes);
      searchCacheRef.current = {
        customers: cr?.data?.customers ?? cr?.data ?? cr?.customers ?? [],
        conversations: cv?.conversations ?? cv?.data?.conversations ?? cv?.data ?? [],
        calls: ca?.calls ?? ca?.data ?? [],
        leads: lr?.data ?? lr?.leads ?? [],
        jobs: jr?.data ?? jr?.jobs ?? [],
        ts: Date.now(),
      };
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    loadSearchData();
  }, [loadSearchData]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const filterSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (!text.trim() || !searchCacheRef.current) {
      setSearchResults([]);
      return;
    }
    const q = text.toLowerCase();
    const cache = searchCacheRef.current;
    const grouped: GroupedResults[] = [];

    // Build phone → customer lookup for linking calls to customers
    const phoneToCustomer: Record<string, any> = {};
    for (const c of cache.customers) {
      if (c.phone_number) {
        const digits = c.phone_number.replace(/\D/g, "");
        phoneToCustomer[digits] = c;
        if (digits.length >= 10) phoneToCustomer[digits.slice(-10)] = c;
      }
    }

    // ── Customers ──
    const matchedCustomers = cache.customers
      .filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone_number?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((c: any) => ({
        id: `cust-${c.id}`,
        category: "customers",
        title: c.name || "Unknown",
        subtitle: c.phone_number || c.email || "",
        route: `/(dashboard)/customers/${c.id}`,
      }));
    if (matchedCustomers.length) grouped.push({ category: "customers", data: matchedCustomers });

    // ── Messages (inbox conversations) ──
    const matchedMessages = cache.conversations
      .filter((c: any) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.last_message?.toLowerCase().includes(q) ||
        c.phone_number?.includes(q)
      )
      .slice(0, 8)
      .map((c: any) => ({
        id: `msg-${c.customer_id}`,
        category: "messages",
        title: c.customer_name || c.phone_number || "Unknown",
        subtitle: c.phone_number || "",
        snippet: c.last_message?.toLowerCase().includes(q) ? searchSnippet(c.last_message, text) : undefined,
        route: `/(dashboard)/customers/${c.customer_id}?tab=messages`,
      }));
    if (matchedMessages.length) grouped.push({ category: "messages", data: matchedMessages });

    // ── Calls & Transcripts ──
    const matchedCalls = cache.calls
      .filter((c: any) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.transcript?.toLowerCase().includes(q) ||
        c.phone_number?.includes(q) ||
        c.outcome?.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((c: any) => {
        const digits = c.phone_number?.replace(/\D/g, "") || "";
        const matched = phoneToCustomer[digits] || phoneToCustomer[digits.slice(-10)];
        const customerId = matched?.id || c.customer_id;
        const hasTranscript = c.transcript?.toLowerCase().includes(q);
        return {
          id: `call-${c.id}`,
          category: "calls",
          title: `${c.direction === "inbound" ? "Inbound" : "Outbound"} Call${c.customer_name ? ` \u2022 ${c.customer_name}` : ""}`,
          subtitle: c.phone_number || "",
          snippet: hasTranscript ? searchSnippet(c.transcript, text) : undefined,
          route: customerId
            ? `/(dashboard)/customers/${customerId}?tab=calls&expand=${c.id}`
            : `/(dashboard)/calls`,
        };
      });
    if (matchedCalls.length) grouped.push({ category: "calls", data: matchedCalls });

    // ── Jobs ──
    const matchedJobs = cache.jobs
      .filter((j: any) =>
        j.title?.toLowerCase().includes(q) ||
        j.customer_name?.toLowerCase().includes(q) ||
        j.notes?.toLowerCase().includes(q) ||
        j.address?.toLowerCase().includes(q) ||
        j.service_type?.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((j: any) => ({
        id: `job-${j.id}`,
        category: "jobs",
        title: j.title || j.customer_name || "Job",
        subtitle: j.address || j.service_type || j.status || "",
        route: "/(dashboard)/calendar",
      }));
    if (matchedJobs.length) grouped.push({ category: "jobs", data: matchedJobs });

    // ── Leads ──
    const matchedLeads = cache.leads
      .filter((l: any) =>
        l.name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.service_interest?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((l: any) => ({
        id: `lead-${l.id}`,
        category: "leads",
        title: l.name || "Unknown Lead",
        subtitle: [l.status, l.service_interest].filter(Boolean).join(" \u2022 ") || l.phone || "",
        route: "/(dashboard)/leads",
      }));
    if (matchedLeads.length) grouped.push({ category: "leads", data: matchedLeads });

    setSearchResults(grouped);
  }, []);

  const handleResultPress = useCallback(
    (item: SearchResult) => {
      closeSearch();
      router.push(item.route as any);
    },
    [closeSearch, router]
  );

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
              {/* Search Button */}
              <TouchableOpacity
                onPress={openSearch}
                style={styles.searchButton}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={20} color={Theme.foreground} />
              </TouchableOpacity>

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
                gestureEnabled: false, // disable iOS swipe-back — drawer handles left-edge swipes
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

          {/* Search Overlay */}
          <Modal
            visible={searchOpen}
            animationType="fade"
            transparent
            onRequestClose={closeSearch}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={[styles.searchOverlay, { paddingTop: insets.top }]}
            >
              {/* Search Header */}
              <View style={styles.searchHeader}>
                <View style={styles.searchInputRow}>
                  <Ionicons name="search" size={18} color={Theme.mutedForeground} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search customers, jobs, leads..."
                    placeholderTextColor={Theme.mutedForeground}
                    value={searchQuery}
                    onChangeText={filterSearch}
                    autoFocus
                    returnKeyType="search"
                    selectionColor={Theme.primary}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => filterSearch("")}>
                      <Ionicons name="close-circle" size={18} color={Theme.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={closeSearch} style={styles.searchCloseBtn}>
                  <Ionicons name="close" size={24} color={Theme.foreground} />
                </TouchableOpacity>
              </View>

              {/* Results */}
              <View style={{ flex: 1 }}>
                {searchLoading ? (
                  <View style={styles.searchCenter}>
                    <ActivityIndicator color={Theme.primary} />
                  </View>
                ) : searchResults.length === 0 && searchQuery.trim().length > 0 ? (
                  <View style={styles.searchCenter}>
                    <Ionicons name="search-outline" size={32} color={Theme.mutedForeground} />
                    <Text style={styles.searchEmptyText}>No results found</Text>
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.category}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    renderItem={({ item: group }) => (
                      <View style={styles.searchGroup}>
                        <View style={styles.searchGroupHeader}>
                          <Ionicons
                            name={(CATEGORY_ICONS[group.category] ?? "list-outline") as any}
                            size={16}
                            color={Theme.primary}
                          />
                          <Text style={styles.searchGroupTitle}>
                            {group.category === "calls" ? "Calls & Transcripts" : group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                          </Text>
                        </View>
                        {group.data.map((result) => (
                          <TouchableOpacity
                            key={result.id}
                            style={styles.searchResultItem}
                            onPress={() => handleResultPress(result)}
                            activeOpacity={0.6}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.searchResultTitle}>{result.title}</Text>
                              {result.subtitle ? (
                                <Text style={styles.searchResultSub}>{result.subtitle}</Text>
                              ) : null}
                              {result.snippet ? (
                                <Text style={styles.searchSnippet} numberOfLines={2}>
                                  {result.snippet}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Theme.mutedForeground} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                )}
              </View>
            </KeyboardAvoidingView>
          </Modal>
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
  searchButton: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchOverlay: {
    flex: 1, backgroundColor: "rgba(10,11,13,0.97)",
  },
  searchHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  searchInputRow: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    paddingHorizontal: 12, height: 42,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: Theme.foreground, height: 42,
  },
  searchCloseBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  searchCenter: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    paddingTop: 60,
  },
  searchEmptyText: { fontSize: 14, color: Theme.mutedForeground },
  searchGroup: { marginTop: 16 },
  searchGroupHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8,
  },
  searchGroupTitle: {
    fontSize: 13, fontWeight: "600", color: Theme.primary,
    textTransform: "capitalize",
  },
  searchResultItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: "rgba(30,28,36,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
    marginBottom: 6,
  },
  searchResultTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  searchResultSub: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  searchSnippet: {
    fontSize: 12, color: Theme.zinc400, marginTop: 4,
    fontStyle: "italic", lineHeight: 17,
  },
});
