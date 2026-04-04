import React, { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  adminOnly?: boolean;
  tenantOnly?: string;
}

// Matches the web app sidebar exactly — same items, same order
const navigation: NavItem[] = [
  { label: "Command Center", icon: "grid-outline", route: "/(dashboard)/overview" },
  { label: "Customers", icon: "person-circle-outline", route: "/(dashboard)/customers" },
  { label: "Calendar", icon: "calendar-outline", route: "/(dashboard)/calendar" },
  { label: "Pipeline", icon: "locate-outline", route: "/(dashboard)/leads" },
  { label: "Teams", icon: "people-outline", route: "/(dashboard)/teams" },
  { label: "Crew Assignment", icon: "time-outline", route: "/(dashboard)/crews", tenantOnly: "winbros" },
  { label: "Insights", icon: "bulb-outline", route: "/(dashboard)/insights" },
  { label: "Assistant", icon: "sparkles-outline", route: "/(dashboard)/assistant" },
  { label: "Debug", icon: "bug-outline", route: "/(dashboard)/exceptions", adminOnly: true },
  { label: "Admin", icon: "shield-outline", route: "/(dashboard)/admin", adminOnly: true },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, tenant, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = user?.username === "admin";
  const tenantSlug = tenant?.business_name_short?.toLowerCase() || "";

  const navigate = (route: string) => {
    router.push(route as any);
    onClose?.();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const handleSettings = () => {
    router.push("/(dashboard)/settings" as any);
    onClose?.();
  };

  const isActive = (route: string) => {
    const path = route.replace("/(dashboard)", "");
    return pathname.includes(path);
  };

  const filteredNav = navigation.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.tenantOnly && item.tenantOnly !== tenantSlug) return false;
    return true;
  });

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
        {active && (
          <LinearGradient
            colors={["#7c3aed", "#4f46e5"]}
            style={styles.activeBorder}
          />
        )}
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
      {/* Logo — matches web: icon + "CLEAN MACHINE" text */}
      <TouchableOpacity
        style={styles.logoSection}
        onPress={() => navigate("/(dashboard)/overview")}
        activeOpacity={0.8}
      >
        <View style={styles.logoIconWrapper}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoLetter}>C</Text>
          </View>
          {/* Glow ring behind logo */}
          <View style={styles.logoGlow} />
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
          {filteredNav.map(renderNavItem)}
        </View>
      </ScrollView>

      {/* User switcher — matches web: avatar + name + chevrons, expandable menu */}
      <View style={[styles.userSection, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.userSwitcher}
          onPress={() => setUserMenuOpen(!userMenuOpen)}
          activeOpacity={0.7}
        >
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
          <Ionicons
            name={userMenuOpen ? "chevron-up" : "chevron-expand-outline"}
            size={16}
            color={Theme.mutedForeground}
          />
        </TouchableOpacity>

        {/* Expandable menu — matches web's user switcher popover */}
        {userMenuOpen && (
          <View style={styles.userMenu}>
            <TouchableOpacity onPress={handleSettings} style={styles.menuItem}>
              <Ionicons name="settings-outline" size={16} color={Theme.mutedForeground} />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
              <Ionicons name="log-out-outline" size={16} color={Theme.destructive} />
              <Text style={[styles.menuItemText, { color: Theme.destructive }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}
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
  logoIconWrapper: {
    position: "relative",
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  logoGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.15)",
    zIndex: 0,
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
    top: 4,
    bottom: 4,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
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
    paddingTop: 4,
  },
  userSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
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
  userMenu: {
    marginTop: 4,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Theme.popover,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: {
    color: Theme.foreground,
    fontSize: 13,
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
