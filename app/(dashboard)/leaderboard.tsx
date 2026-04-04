import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

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
      style={styles.container}
      data={rankings}
      keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      renderItem={({ item, index }) => (
        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rankContainer}>
              {index < 3 ? (
                <Ionicons name="trophy" size={24} color={medalColors[index]} />
              ) : (
                <Text style={styles.rankText}>#{index + 1}</Text>
              )}
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.nameText}>
                {item.name || item.cleaner_name || `Crew ${index + 1}`}
              </Text>
              <Text style={styles.subText}>
                {item.jobs_completed ?? 0} jobs
              </Text>
            </View>
            <Text style={styles.revenueText}>
              ${item.revenue ?? item.total ?? 0}
            </Text>
          </View>
        </GlassCard>
      )}
      ListEmptyComponent={
        <EmptyState icon="trophy-outline" title="No rankings" description="Leaderboard data will appear here" />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  card: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.zinc400,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  revenueText: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.success,
  },
});
