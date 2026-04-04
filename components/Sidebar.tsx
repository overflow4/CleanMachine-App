import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { Theme, NavColors } from "@/constants/colors";

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const mainNav: NavItem[] = [
  { label: "Command Center", icon: "grid-outline", route: "/(dashboard)/overview" },
  { label: "Customers", icon: "person-circle-outline", route: "/(dashboard)/customers" },
  { label: "Calendar", icon: "calendar-outline", route: "/(dashboard)/calendar" },
  { label: "Pipeline", icon: "funnel-outline", route: "/(dashboard)/leads" },
  { label: "Teams", icon: "people-outline", route: "/(dashboard)/teams" },
  { label: "Schedule", icon: "time-outline", route: "/(dashboard)/schedule" },
  { label: "Insights", icon: "bulb-outline", route: "/(dashboard)/insights" },
  { label: "Assistant", icon: "sparkles-outline", route: "/(dashboard)/assistant" },
];

const secondaryNav: NavItem[] = [
  { label: "Inbox", icon: "mail-outline", route: "/(dashboard)/inbox" },
  { label: "Campaigns", icon: "megaphone-outline", route: "/(dashboard)/campaigns" },
  { label: "Earnings", icon: "cash-outline", route: "/(dashboard)/earnings" },
  { label: "Quotes", icon: "document-text-outline", route: "/(dashboard)/quotes" },
  { label: "Crews", icon: "construct-outline", route: "/(dashboard)/crews" },
  { label: "Memberships", icon: "card-outline", route: "/(dashboard)/memberships" },
  { label: "Calls", icon: "call-outline", route: "/(dashboard)/calls" },
  { label: "Leaderboard", icon: "trophy-outline", route: "/(dashboard)/leaderboard" },
  { label: "Rain Day", icon: "rainy-outline", route: "/(dashboard)/rain-day" },
  { label: "Exceptions", icon: "bug-outline", route: "/(dashboard)/exceptions" },
  { label: "Retargeting", icon: "refresh-outline", route: "/(dashboard)/retargeting" },
  { label: "Settings", icon: "settings-outline", route: "/(dashboard)/settings" },
  { label: "Admin", icon: "shield-outline", route: "/(dashboard)/admin" },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, tenant, logout } = useAuth();

  const navigate = (route: string) => {
    router.push(route as any);
    onClose?.();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isActive = (route: string) => {
    const path = route.replace("/(dashboard)", "");
    return pathname.includes(path);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.route);
    return (
      <TouchableOpacity
        key={item.route}
        onPress={() => navigate(item.route)}
        style={[
          styles.navItem,
          active && styles.navItemActive,
        ]}
        activeOpacity={0.7}
      >
        {active && <View style={styles.activeBorder} />}
        <Ionicons
          name={active ? (item.icon.replace("-outline", "") as any) : item.icon}
          size={18}
          color={active ? NavColors.activeIcon : NavColors.inactiveText}
        />
        <Text
          style={[
            styles.navLabel,
            active ? styles.navLabelActive : styles.navLabelInactive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Logo */}
      <TouchableOpacity
        style={styles.logoSection}
        onPress={() => navigate("/(dashboard)/overview")}
      >
        <View style={styles.logoIcon}>
          <Text style={styles.logoLetter}>C</Text>
        </View>
        <Text style={styles.logoText}>CLEAN MACHINE</Text>
      </TouchableOpacity>

      {/* Navigation */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navSection}>
          {mainNav.map(renderNavItem)}
        </View>
        <View style={styles.divider} />
        <View style={styles.navSection}>
          {secondaryNav.map(renderNavItem)}
        </View>
      </ScrollView>

      {/* User section */}
      <View style={[styles.userSection, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.divider} />
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.display_name?.[0] || user?.username?.[0] || "U").toUpperCase()}
            </Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.display_name || user?.username || "User"}
            </Text>
            <Text style={styles.tenantName} numberOfLines={1}>
              {tenant?.business_name_short || tenant?.business_name || ""}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={Theme.destructive} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.sidebar,
    borderRightWidth: 1,
    borderRightColor: Theme.sidebarBorder,
  },
  logoSection: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  logoText: {
    color: Theme.foreground,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingVertical: 8,
  },
  navSection: {
    paddingHorizontal: 12,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 12,
    marginVertical: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: NavColors.activeBg,
  },
  activeBorder: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Theme.violet600,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  navLabelActive: {
    color: NavColors.activeText,
  },
  navLabelInactive: {
    color: NavColors.inactiveText,
  },
  userSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: Theme.primaryLight,
    fontSize: 14,
    fontWeight: "600",
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    color: Theme.foreground,
    fontSize: 13,
    fontWeight: "500",
  },
  tenantName: {
    color: Theme.mutedForeground,
    fontSize: 11,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  logoutText: {
    color: Theme.destructive,
    fontSize: 13,
    fontWeight: "500",
  },
});
