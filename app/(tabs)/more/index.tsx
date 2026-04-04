import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

interface MenuItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
}

const mainItems: MenuItem[] = [
  { title: "Leads", icon: "trending-up-outline", route: "/(tabs)/more/leads", color: "#f59e0b" },
  { title: "AI Assistant", icon: "sparkles-outline", route: "/(tabs)/more/assistant", color: "#8b5cf6" },
  { title: "Inbox", icon: "mail-outline", route: "/(tabs)/more/inbox", color: "#3b82f6" },
  { title: "Campaigns", icon: "megaphone-outline", route: "/(tabs)/more/campaigns", color: "#ec4899" },
  { title: "Earnings", icon: "cash-outline", route: "/(tabs)/more/earnings", color: "#22c55e" },
  { title: "Admin", icon: "shield-outline", route: "/(tabs)/more/admin", color: "#ef4444" },
];

const secondaryItems: MenuItem[] = [
  { title: "Quotes", icon: "document-text-outline", route: "/(tabs)/more/quotes", color: "#06b6d4" },
  { title: "Schedule", icon: "calendar-outline", route: "/(tabs)/more/schedule", color: "#3b82f6" },
  { title: "Crews", icon: "construct-outline", route: "/(tabs)/more/crews", color: "#8b5cf6" },
  { title: "Memberships", icon: "card-outline", route: "/(tabs)/more/memberships", color: "#22c55e" },
  { title: "Leaderboard", icon: "trophy-outline", route: "/(tabs)/more/leaderboard", color: "#f59e0b" },
  { title: "Insights", icon: "analytics-outline", route: "/(tabs)/more/insights", color: "#06b6d4" },
  { title: "Rain Day", icon: "rainy-outline", route: "/(tabs)/more/rain-day", color: "#64748b" },
  { title: "Calls", icon: "call-outline", route: "/(tabs)/more/calls", color: "#22c55e" },
  { title: "Exceptions", icon: "warning-outline", route: "/(tabs)/more/exceptions", color: "#ef4444" },
  { title: "Retargeting", icon: "refresh-outline", route: "/(tabs)/more/retargeting", color: "#ec4899" },
  { title: "Settings", icon: "settings-outline", route: "/(tabs)/more/settings", color: "#64748b" },
];

export default function MoreScreen() {
  const router = useRouter();
  const { logout, user, tenant } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <ScrollView className="flex-1 bg-dark-50 dark:bg-dark-900">
      {/* User Info */}
      <View className="mx-4 mt-4 mb-4 rounded-xl bg-white p-4 dark:bg-dark-800">
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {(user?.display_name?.[0] || user?.username?.[0] || "U").toUpperCase()}
            </Text>
          </View>
          <View className="ml-3">
            <Text className="text-lg font-semibold text-dark-900 dark:text-white">
              {user?.display_name || user?.username}
            </Text>
            <Text className="text-sm text-dark-500 dark:text-dark-400">
              {tenant?.business_name || tenant?.name || ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Items */}
      <View className="mx-4 mb-4">
        <Text className="mb-2 text-sm font-medium uppercase text-dark-500 dark:text-dark-400">
          Main
        </Text>
        <View className="rounded-xl bg-white dark:bg-dark-800">
          {mainItems.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => router.push(item.route as any)}
              className={`flex-row items-center px-4 py-3.5 ${
                index < mainItems.length - 1 ? "border-b border-dark-100 dark:border-dark-700" : ""
              }`}
            >
              <View
                className="h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: item.color + "20" }}
              >
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text className="ml-3 flex-1 text-base text-dark-900 dark:text-white">
                {item.title}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Secondary Items */}
      <View className="mx-4 mb-4">
        <Text className="mb-2 text-sm font-medium uppercase text-dark-500 dark:text-dark-400">
          More Features
        </Text>
        <View className="rounded-xl bg-white dark:bg-dark-800">
          {secondaryItems.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => router.push(item.route as any)}
              className={`flex-row items-center px-4 py-3.5 ${
                index < secondaryItems.length - 1
                  ? "border-b border-dark-100 dark:border-dark-700"
                  : ""
              }`}
            >
              <View
                className="h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: item.color + "20" }}
              >
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text className="ml-3 flex-1 text-base text-dark-900 dark:text-white">
                {item.title}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <View className="mx-4 mb-8">
        <Button title="Sign Out" variant="danger" onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}
