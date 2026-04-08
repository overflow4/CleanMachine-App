import React from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchInsightsData } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { CleanerPerformance } from "@/types";

export default function InsightsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["insights"],
    queryFn: fetchInsightsData,
  });

  // API returns camelCase fields: name, jobsCompleted, revenue (not snake_case)
  const rawPerf: any[] = (data as any)?.cleanerPerformance ?? [];
  // Filter out entries without a name and normalize fields
  const cleanerPerformance = rawPerf
    .filter((p: any) => p.name)
    .map((p: any) => ({
      cleaner_id: p.id || p.cleaner_id,
      cleaner_name: p.name || p.cleaner_name,
      jobs_completed: p.jobsCompleted ?? p.jobs_completed ?? 0,
      revenue: p.revenue ?? 0,
      avg_rating: p.avgRating ?? p.avg_rating ?? null,
      upsell_rate: p.upsellRate ?? p.upsell_rate ?? null,
    }));
  const messageAnalytics: any = (data as any)?.messageAnalytics ?? {};

  if (isLoading) return <LoadingScreen message="Loading insights..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      <View style={styles.content}>
        {/* Message Analytics */}
        {messageAnalytics && Object.keys(messageAnalytics).length > 0 && (
          <GlassCard style={styles.analyticsCard}>
            <Text style={styles.sectionTitle}>Message Analytics</Text>
            {Object.entries(messageAnalytics).map(([key, value]) => (
              <View key={key} style={styles.analyticsRow}>
                <Text style={styles.analyticsLabel}>
                  {key.replace(/_/g, " ")}
                </Text>
                <Text style={styles.analyticsValue}>
                  {typeof value === "number" ? value : String(value)}
                </Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Cleaner Performance */}
        <Text style={styles.sectionTitle}>Cleaner Performance</Text>
        {cleanerPerformance.length === 0 ? (
          <EmptyState icon="analytics-outline" title="No data" description="Performance data will appear here" />
        ) : (
          cleanerPerformance.map((perf, i) => (
            <GlassCard key={perf.cleaner_id || i} style={styles.perfCard}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{perf.cleaner_name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.nameText}>{perf.cleaner_name}</Text>
                  <Text style={styles.subText}>
                    {perf.jobs_completed} jobs {"\u2022"} ${perf.revenue}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {perf.avg_rating != null && (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color={Theme.warning} />
                      <Text style={styles.ratingText}>
                        {perf.avg_rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {perf.upsell_rate != null && (
                    <Text style={styles.upsellText}>
                      {(perf.upsell_rate * 100).toFixed(0)}% upsell
                    </Text>
                  )}
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  analyticsCard: {
    marginBottom: 16,
  },
  analyticsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    paddingVertical: 8,
  },
  analyticsLabel: {
    color: Theme.mutedForeground,
    textTransform: "capitalize",
  },
  analyticsValue: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  perfCard: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "600",
    color: Theme.teal400,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  upsellText: {
    fontSize: 11,
    color: Theme.zinc400,
  },
});
