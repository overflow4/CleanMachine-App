import React from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { Campaign } from "@/types";

export default function CampaignsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => apiFetch("/api/campaigns"),
  });

  const campaigns: Campaign[] = (data as any)?.data ?? (data as any)?.campaigns ?? [];

  if (isLoading) return <LoadingScreen message="Loading campaigns..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      <View style={styles.section}>
        {campaigns.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No campaigns"
            description="Marketing campaigns will appear here"
          />
        ) : (
          campaigns.map((campaign, i) => (
            <GlassCard key={campaign.id || i} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{campaign.name}</Text>
                  <Text style={styles.subText}>{campaign.type}</Text>
                </View>
                <Badge
                  label={campaign.status}
                  variant={
                    campaign.status === "active"
                      ? "success"
                      : campaign.status === "completed"
                      ? "info"
                      : campaign.status === "paused"
                      ? "warning"
                      : "default"
                  }
                />
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{campaign.target_count}</Text>
                  <Text style={styles.metricLabel}>Target</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Theme.primary }]}>{campaign.sent_count}</Text>
                  <Text style={styles.metricLabel}>Sent</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Theme.success }]}>{campaign.response_count}</Text>
                  <Text style={styles.metricLabel}>Responses</Text>
                </View>
              </View>
              <Text style={styles.dateText}>
                {new Date(campaign.created_at).toLocaleDateString()}
              </Text>
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
  section: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  subText: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  metricsRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricItem: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.foreground,
  },
  metricLabel: {
    fontSize: 11,
    color: Theme.mutedForeground,
  },
  dateText: {
    marginTop: 8,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
