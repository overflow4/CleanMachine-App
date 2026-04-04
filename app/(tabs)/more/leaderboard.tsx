import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LeaderboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch("/api/leaderboard"),
  });

  const rankings: any[] = (data as any)?.data ?? (data as any)?.rankings ?? [];

  if (isLoading) return <LoadingScreen message="Loading leaderboard..." />;

  const medalColors = ["#fbbf24", "#94a3b8", "#d97706"];

  return (
    <FlatList
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      data={rankings}
      keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      renderItem={({ item, index }) => (
        <Card className="mb-2">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center">
              {index < 3 ? (
                <Ionicons name="trophy" size={24} color={medalColors[index]} />
              ) : (
                <Text className="text-lg font-bold text-dark-400">#{index + 1}</Text>
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-medium text-dark-900 dark:text-white">
                {item.name || item.cleaner_name || `Crew ${index + 1}`}
              </Text>
              <Text className="text-sm text-dark-500 dark:text-dark-400">
                {item.jobs_completed ?? 0} jobs
              </Text>
            </View>
            <Text className="text-lg font-bold text-green-600 dark:text-green-400">
              ${item.revenue ?? item.total ?? 0}
            </Text>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <EmptyState icon="trophy-outline" title="No rankings" description="Leaderboard data will appear here" />
      }
    />
  );
}
