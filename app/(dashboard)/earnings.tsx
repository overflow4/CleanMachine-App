import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchEarnings } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

type Period = "today" | "week" | "month";

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>("today");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["earnings", period],
    queryFn: () => fetchEarnings(period),
  });

  const earnings: any = data ?? {};

  const breakdown: any[] = useMemo(
    () => (earnings.breakdown && Array.isArray(earnings.breakdown) ? earnings.breakdown : []),
    [earnings.breakdown]
  );

  const maxBreakdownAmount = useMemo(() => {
    if (breakdown.length === 0) return 1;
    return Math.max(...breakdown.map((item: any) => Number(item.amount ?? item.total ?? 0)), 1);
  }, [breakdown]);

  if (isLoading) return <LoadingScreen message="Loading earnings..." />;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  const tipsValue = Number(earnings.tips ?? 0);
  const upsellsValue = Number(earnings.upsells ?? 0);
  const chartMax = Math.max(tipsValue, upsellsValue, 1);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      {/* Period Selector */}
      <View style={styles.tabBar}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.tab, period === p.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {/* Revenue Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Revenue"
            value={`$${earnings.total_revenue ?? earnings.revenue ?? 0}`}
            icon="cash-outline"
            iconColor={Theme.success}
          />
          <StatCard
            title="Jobs Completed"
            value={earnings.jobs_completed ?? earnings.completed_jobs ?? 0}
            icon="checkmark-circle-outline"
            iconColor={Theme.primary}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Tips"
            value={`$${earnings.tips ?? 0}`}
            icon="heart-outline"
            iconColor="#ec4899"
          />
          <StatCard
            title="Upsells"
            value={`$${earnings.upsells ?? 0}`}
            icon="trending-up-outline"
            iconColor={Theme.warning}
          />
        </View>

        {/* Bar Chart — Tips vs Upsells */}
        {(tipsValue > 0 || upsellsValue > 0) && (
          <GlassCard style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Tips & Upsells</Text>

            {/* Tips bar */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Tips</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((tipsValue / chartMax) * 100)}%`,
                      backgroundColor: "#ec4899",
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>${tipsValue}</Text>
            </View>

            {/* Upsells bar */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Upsells</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((upsellsValue / chartMax) * 100)}%`,
                      backgroundColor: Theme.warning,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>${upsellsValue}</Text>
            </View>
          </GlassCard>
        )}

        {/* Breakdown with bar chart */}
        {breakdown.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>Breakdown</Text>

            {/* Visual bar chart for breakdown items */}
            <GlassCard style={styles.chartCard}>
              {breakdown.map((item: any, i: number) => {
                const amount = Number(item.amount ?? item.total ?? 0);
                const pct = Math.round((amount / maxBreakdownAmount) * 100);
                // Cycle through colors for variety
                const colors = [Theme.primary, Theme.success, "#ec4899", Theme.warning, "#8b5cf6", "#06b6d4"];
                const color = colors[i % colors.length];

                return (
                  <View key={i} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {item.label || item.name || `Item ${i + 1}`}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(pct, 2)}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>${amount}</Text>
                  </View>
                );
              })}
            </GlassCard>

            {/* Detail cards */}
            {breakdown.map((item: any, i: number) => (
              <GlassCard key={i} style={styles.breakdownCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.nameText}>
                      {item.label || item.name || `Item ${i + 1}`}
                    </Text>
                    <Text style={styles.subText}>{item.count ?? 0} jobs</Text>
                  </View>
                  <Text style={styles.earningsValue}>
                    ${item.amount ?? item.total ?? 0}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
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
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: Theme.card,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
  },
  content: {
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  chartCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  barLabel: {
    width: 70,
    fontSize: 12,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  barTrack: {
    flex: 1,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.muted,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 10,
    minWidth: 4,
  },
  barValue: {
    width: 60,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "right",
  },
  breakdownSection: {
    marginBottom: 16,
  },
  breakdownCard: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.success,
  },
});
