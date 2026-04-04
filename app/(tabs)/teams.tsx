import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchTeams, fetchTeamMessages, fetchTeamEarnings, manageTeam, sendEmployeeCredentials } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cleaner } from "@/types";

type Tab = "members" | "messages" | "earnings";

export default function TeamsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const messagesQuery = useQuery({
    queryKey: ["team-messages"],
    queryFn: () => fetchTeamMessages(),
    enabled: activeTab === "messages",
  });

  const earningsQuery = useQuery({
    queryKey: ["team-earnings"],
    queryFn: () => fetchTeamEarnings(),
    enabled: activeTab === "earnings",
  });

  const credentialsMutation = useMutation({
    mutationFn: (cleanerId: number) => sendEmployeeCredentials(cleanerId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Credentials sent");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const teamsData: any = teamsQuery.data;
  const cleaners: Cleaner[] = teamsData?.cleaners ?? teamsData?.data ?? [];
  const messages: any[] = (messagesQuery.data as any)?.messages ?? (messagesQuery.data as any)?.data ?? [];
  const earnings: any[] = (earningsQuery.data as any)?.earnings ?? (earningsQuery.data as any)?.data ?? [];

  const onRefresh = useCallback(async () => {
    await Promise.all([
      teamsQuery.refetch(),
      activeTab === "messages" ? messagesQuery.refetch() : Promise.resolve(),
      activeTab === "earnings" ? earningsQuery.refetch() : Promise.resolve(),
    ]);
  }, [activeTab]);

  if (teamsQuery.isLoading && !cleaners.length) {
    return <LoadingScreen message="Loading teams..." />;
  }

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "members", label: "Members", icon: "people-outline" },
    { key: "messages", label: "Messages", icon: "chatbubbles-outline" },
    { key: "earnings", label: "Earnings", icon: "cash-outline" },
  ];

  return (
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      {/* Tab Selector */}
      <View className="mx-4 mt-2 mb-3 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 flex-row items-center justify-center rounded-md py-2.5 ${
              activeTab === tab.key ? "bg-white dark:bg-dark-700" : ""
            }`}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? "#3b82f6" : "#94a3b8"}
            />
            <Text
              className={`ml-1.5 text-sm font-medium ${
                activeTab === tab.key
                  ? "text-primary-500"
                  : "text-dark-500 dark:text-dark-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={teamsQuery.isRefetching} onRefresh={onRefresh} />
        }
      >
        {activeTab === "members" && (
          <View className="px-4">
            {cleaners.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No team members"
                description="Team members will appear here"
              />
            ) : (
              cleaners.map((cleaner, i) => (
                <Card key={cleaner.id || i} className="mb-2">
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Text className="font-semibold text-purple-600 dark:text-purple-400">
                        {cleaner.name?.[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="font-medium text-dark-900 dark:text-white">
                        {cleaner.name}
                      </Text>
                      <Text className="text-sm text-dark-500 dark:text-dark-400">
                        {cleaner.phone || "No phone"}
                      </Text>
                    </View>
                    <View className="items-end">
                      {cleaner.employee_type && (
                        <Badge
                          label={cleaner.employee_type}
                          variant={cleaner.employee_type === "salesman" ? "info" : "default"}
                        />
                      )}
                      {cleaner.is_team_lead && (
                        <Badge label="Team Lead" variant="warning" />
                      )}
                    </View>
                  </View>
                  <View className="mt-2 flex-row justify-end">
                    <Button
                      title="Send Credentials"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        if (cleaner.id) {
                          credentialsMutation.mutate(Number(cleaner.id));
                        }
                      }}
                      loading={credentialsMutation.isPending}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === "messages" && (
          <View className="px-4">
            {messages.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No messages"
                description="Team messages will appear here"
              />
            ) : (
              messages.map((msg, i) => (
                <Card key={i} className="mb-2">
                  <View className="flex-row items-start">
                    <Ionicons name="chatbubble-outline" size={16} color="#94a3b8" />
                    <View className="ml-2 flex-1">
                      <Text className="font-medium text-dark-900 dark:text-white">
                        {msg.sender_name || msg.cleaner_name || "Unknown"}
                      </Text>
                      <Text className="text-sm text-dark-700 dark:text-dark-300">
                        {msg.content || msg.message || ""}
                      </Text>
                      <Text className="mt-1 text-xs text-dark-400">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === "earnings" && (
          <View className="px-4">
            {earnings.length === 0 ? (
              <EmptyState
                icon="cash-outline"
                title="No earnings data"
                description="Earnings will appear here"
              />
            ) : (
              earnings.map((item, i) => (
                <Card key={i} className="mb-2">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-medium text-dark-900 dark:text-white">
                        {item.cleaner_name || item.name || `Cleaner ${i + 1}`}
                      </Text>
                      <Text className="text-sm text-dark-500 dark:text-dark-400">
                        {item.jobs_completed ?? 0} jobs
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-green-600 dark:text-green-400">
                      ${item.total_earnings ?? item.revenue ?? 0}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
