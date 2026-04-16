import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchEarnings } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { BarChart } from "@/components/ui/charts/BarChart";
import { Theme } from "@/constants/colors";

type Period = "today" | "week" | "month";
type ActivityTab = "tips" | "upsells";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

function formatCurrency(value: number | undefined | null): string {
  const num = Number(value ?? 0);
  return num >= 1000
    ? `$${(num / 1000).toFixed(1)}k`
    : `$${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>("today");
  const [activityTab, setActivityTab] = useState<ActivityTab>("tips");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["earnings", period],
    queryFn: () => fetchEarnings(period),
  });

  const earnings = data ?? ({} as any);

  const chartData = Array.isArray(earnings.chart_data) ? earnings.chart_data : [];
  const teamBreakdown = Array.isArray(earnings.team_breakdown) ? earnings.team_breakdown : [];
  const recentTips = Array.isArray(earnings.recent_tips) ? earnings.recent_tips : [];
  const recentUpsells = Array.isArray(earnings.recent_upsells) ? earnings.recent_upsells : [];

  const handlePeriodChange = useCallback(
    (key: Period) => {
      if (key !== period) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPeriod(key);
      }
    },
    [period]
  );

  const handleActivityTabChange = useCallback(
    (tab: ActivityTab) => {
      if (tab !== activityTab) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActivityTab(tab);
      }
    },
    [activityTab]
  );

  // Build bar chart items from chart_data
  const barChartItems = chartData.map((item: any) => ({
    label: item.label ?? "",
    value: Number(item.revenue ?? 0),
    color: Theme.primary,
    secondaryValue: Number(item.tips ?? 0),
    secondaryColor: Theme.pink500,
  }));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.primary} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  const isEmpty =
    !earnings.total_revenue &&
    !earnings.total_tips &&
    !earnings.jobs_completed &&
    chartData.length === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={Theme.primary}
        />
      }
    >
      {/* Period Selector */}
      <View style={styles.periodBar}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => handlePeriodChange(p.key)}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodTabText,
                period === p.key && styles.periodTabTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={48} color={Theme.zinc600} />
          <Text style={styles.emptyTitle}>No earnings data</Text>
          <Text style={styles.emptySubtitle}>
            Earnings will appear here once jobs are completed.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* 2x2 Metric Cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricsRow}>
              <MetricCard
                title="Total Revenue"
                value={formatCurrency(earnings.total_revenue)}
                icon="cash-outline"
                iconColor={Theme.success}
                trend={earnings.revenue_trend}
              />
              <MetricCard
                title="Total Tips"
                value={formatCurrency(earnings.total_tips)}
                icon="heart-outline"
                iconColor={Theme.pink500}
                trend={earnings.tips_trend}
              />
            </View>
            <View style={styles.metricsRow}>
              <MetricCard
                title="Avg Tip/Job"
                value={formatCurrency(earnings.avg_tip_per_job)}
                icon="analytics-outline"
                iconColor={Theme.blue400}
                trend={earnings.avg_tip_trend}
              />
              <MetricCard
                title="Upsell Rate"
                value={`${Number(earnings.upsell_rate ?? 0).toFixed(1)}%`}
                icon="trending-up-outline"
                iconColor={Theme.warning}
                trend={earnings.upsell_rate_trend}
              />
            </View>
          </View>

          {/* Revenue Bar Chart */}
          {barChartItems.length > 0 && (
            <GlassCard style={styles.section}>
              <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>Revenue Trend</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Theme.primary }]} />
                    <Text style={styles.legendText}>Revenue</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Theme.pink500 }]} />
                    <Text style={styles.legendText}>Tips</Text>
                  </View>
                </View>
              </View>
              <BarChart
                data={barChartItems}
                height={200}
                formatValue={(v) => formatCurrency(v)}
                barColor={Theme.primary}
              />
            </GlassCard>
          )}

          {/* Team Breakdown */}
          {teamBreakdown.length > 0 && (
            <GlassCard style={styles.section}>
              <Text style={styles.sectionTitle}>Team Breakdown</Text>
              {teamBreakdown
                .sort((a: any, b: any) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0))
                .map((member: any, index: number) => (
                  <View key={index} style={styles.teamRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{member.name}</Text>
                      <Text style={styles.teamMeta}>
                        {member.jobs ?? 0} jobs
                        {member.tips ? ` \u00B7 ${formatCurrency(member.tips)} tips` : ""}
                        {member.upsells ? ` \u00B7 ${formatCurrency(member.upsells)} upsells` : ""}
                      </Text>
                    </View>
                    <Text style={styles.teamRevenue}>
                      {formatCurrency(member.revenue)}
                    </Text>
                  </View>
                ))}
            </GlassCard>
          )}

          {/* Recent Activity */}
          {(recentTips.length > 0 || recentUpsells.length > 0) && (
            <GlassCard style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>

              {/* Activity Tab Buttons */}
              <View style={styles.activityTabBar}>
                <TouchableOpacity
                  onPress={() => handleActivityTabChange("tips")}
                  style={[
                    styles.activityTab,
                    activityTab === "tips" && styles.activityTabActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="heart-outline"
                    size={14}
                    color={activityTab === "tips" ? Theme.pink500 : Theme.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.activityTabText,
                      activityTab === "tips" && styles.activityTabTextActive,
                    ]}
                  >
                    Tips ({recentTips.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleActivityTabChange("upsells")}
                  style={[
                    styles.activityTab,
                    activityTab === "upsells" && styles.activityTabActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={14}
                    color={activityTab === "upsells" ? Theme.warning : Theme.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.activityTabText,
                      activityTab === "upsells" && styles.activityTabTextActive,
                    ]}
                  >
                    Upsells ({recentUpsells.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tips List */}
              {activityTab === "tips" && (
                recentTips.length > 0 ? (
                  recentTips.map((tip: any, i: number) => (
                    <View key={i} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: Theme.pink500 + "18" }]}>
                        <Ionicons name="heart" size={14} color={Theme.pink500} />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName}>{tip.team}</Text>
                        <Text style={styles.activityMeta}>
                          Job #{tip.job_id} {tip.created_at ? `\u00B7 ${formatTime(tip.created_at)}` : ""}
                        </Text>
                      </View>
                      <Text style={[styles.activityAmount, { color: Theme.pink500 }]}>
                        +{formatCurrency(tip.amount)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyListText}>No recent tips</Text>
                )
              )}

              {/* Upsells List */}
              {activityTab === "upsells" && (
                recentUpsells.length > 0 ? (
                  recentUpsells.map((upsell: any, i: number) => (
                    <View key={i} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: Theme.warning + "18" }]}>
                        <Ionicons name="trending-up" size={14} color={Theme.warning} />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName}>{upsell.team}</Text>
                        <Text style={styles.activityMeta} numberOfLines={1}>
                          {upsell.description || `Job #${upsell.job_id}`}
                          {upsell.created_at ? ` \u00B7 ${formatTime(upsell.created_at)}` : ""}
                        </Text>
                      </View>
                      <Text style={[styles.activityAmount, { color: Theme.warning }]}>
                        +{formatCurrency(upsell.amount)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyListText}>No recent upsells</Text>
                )
              )}
            </GlassCard>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Theme.mutedForeground,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // Period selector
  periodBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 10,
  },
  periodTabActive: {
    backgroundColor: Theme.card,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  periodTabTextActive: {
    color: Theme.primary,
  },

  content: {
    paddingHorizontal: 16,
  },

  // Metrics grid
  metricsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.foreground,
  },

  // Chart
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Theme.mutedForeground,
  },

  // Team breakdown
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
    gap: 12,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.primary,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  teamMeta: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  teamRevenue: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.success,
  },

  // Activity tabs
  activityTabBar: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 3,
  },
  activityTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activityTabActive: {
    backgroundColor: Theme.card,
  },
  activityTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  activityTabTextActive: {
    color: Theme.foreground,
  },

  // Activity items
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
    gap: 10,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
  },
  activityMeta: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyListText: {
    fontSize: 13,
    color: Theme.zinc500,
    textAlign: "center",
    paddingVertical: 16,
  },
});
