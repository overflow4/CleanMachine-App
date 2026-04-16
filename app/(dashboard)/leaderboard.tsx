import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchLeaderboard } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

type TimeRange = "week" | "month" | "quarter" | "year";
type RankingTab = "tips" | "upsells" | "jobs" | "reviews";

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
];

const RANKING_TABS: {
  key: RankingTab;
  label: string;
  field: string;
  icon: keyof typeof Ionicons.glyphMap;
  format: (v: number) => string;
}[] = [
  {
    key: "tips",
    label: "Tips",
    field: "tips",
    icon: "cash-outline",
    format: (v) => `$${v.toFixed(0)}`,
  },
  {
    key: "upsells",
    label: "Upsells",
    field: "upsells",
    icon: "trending-up-outline",
    format: (v) => `$${v.toFixed(0)}`,
  },
  {
    key: "jobs",
    label: "Jobs",
    field: "jobs_completed",
    icon: "briefcase-outline",
    format: (v) => `${v}`,
  },
  {
    key: "reviews",
    label: "Reviews",
    field: "reviews",
    icon: "star-outline",
    format: (v) => `${v}`,
  },
];

const MEDAL_ICONS: { icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { icon: "trophy", color: "#fbbf24" }, // gold
  { icon: "trophy", color: "#94a3b8" }, // silver
  { icon: "trophy", color: "#d97706" }, // bronze
];

export default function LeaderboardScreen() {
  const [range, setRange] = useState<TimeRange>("month");
  const [activeRankTab, setActiveRankTab] = useState<RankingTab>("tips");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard", range],
    queryFn: () => fetchLeaderboard(range),
  });

  const rankings: any[] =
    (data as any)?.data ?? (data as any)?.rankings ?? [];

  const currentTab = RANKING_TABS.find((t) => t.key === activeRankTab)!;

  // Sort by current tab's field
  const sorted = useMemo(() => {
    return [...rankings].sort((a, b) => {
      const aVal = Number(a[currentTab.field] ?? 0);
      const bVal = Number(b[currentTab.field] ?? 0);
      return bVal - aVal;
    });
  }, [rankings, currentTab.field]);

  if (isLoading) return <LoadingScreen message="Loading leaderboard..." />;

  const renderTopThree = () => {
    if (sorted.length === 0) return null;
    const top = sorted.slice(0, 3);

    return (
      <View style={styles.podiumSection}>
        {top.map((item, index) => {
          const medal = MEDAL_ICONS[index];
          const value = Number(item[currentTab.field] ?? 0);
          const change = Number(item[`${currentTab.field}_change`] ?? item.change ?? 0);

          return (
            <View
              key={item.id?.toString() ?? index.toString()}
              style={[
                styles.podiumCard,
                index === 0 && styles.podiumCardFirst,
              ]}
            >
              <View
                style={[
                  styles.podiumMedal,
                  { backgroundColor: medal.color + "20" },
                ]}
              >
                <Ionicons name={medal.icon} size={24} color={medal.color} />
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>
                {item.name || item.cleaner_name || `Crew ${index + 1}`}
              </Text>
              <Text style={styles.podiumValue}>
                {currentTab.format(value)}
              </Text>
              {change !== 0 && (
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor:
                        change > 0
                          ? Theme.successBg
                          : Theme.destructiveBg,
                    },
                  ]}
                >
                  <Ionicons
                    name={change > 0 ? "arrow-up" : "arrow-down"}
                    size={10}
                    color={
                      change > 0 ? Theme.success : Theme.destructive
                    }
                  />
                  <Text
                    style={[
                      styles.changeText,
                      {
                        color:
                          change > 0 ? Theme.success : Theme.destructive,
                      },
                    ]}
                  >
                    {change > 0 ? "+" : ""}
                    {change}
                  </Text>
                </View>
              )}
              <Text style={styles.podiumRank}>
                {index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const rest = sorted.slice(3);

  return (
    <FlatList
      style={styles.container}
      data={rest}
      keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={Theme.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerSection}>
          {/* Time range selector */}
          <View style={styles.rangeRow}>
            {TIME_RANGES.map((r) => {
              const active = range === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.rangeBtn,
                    active && styles.rangeBtnActive,
                  ]}
                  onPress={() => setRange(r.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.rangeBtnText,
                      active && styles.rangeBtnTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ranking tabs */}
          <View style={styles.rankTabRow}>
            {RANKING_TABS.map((tab) => {
              const active = activeRankTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.rankTab,
                    active && styles.rankTabActive,
                  ]}
                  onPress={() => setActiveRankTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={
                      active ? Theme.primary : Theme.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.rankTabText,
                      active && styles.rankTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Top 3 podium */}
          {renderTopThree()}

          {/* Incentive card */}
          <GlassCard style={styles.incentiveCard}>
            <View style={styles.incentiveRow}>
              <View
                style={[
                  styles.incentiveIcon,
                  { backgroundColor: Theme.warningBg },
                ]}
              >
                <Ionicons
                  name="gift-outline"
                  size={20}
                  color={Theme.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.incentiveTitle}>
                  Incentive Bonus
                </Text>
                <Text style={styles.incentiveDesc}>
                  $10 per Google review from your customers
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Remaining header */}
          {rest.length > 0 && (
            <Text style={styles.restTitle}>Other Rankings</Text>
          )}
        </View>
      }
      renderItem={({ item, index }) => {
        const rank = index + 4;
        const value = Number(item[currentTab.field] ?? 0);
        const change = Number(
          item[`${currentTab.field}_change`] ?? item.change ?? 0
        );

        return (
          <GlassCard style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rankContainer}>
                <Text style={styles.rankText}>#{rank}</Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.nameText}>
                  {item.name || item.cleaner_name || `Crew ${rank}`}
                </Text>
                <Text style={styles.subText}>
                  {item.jobs_completed ?? 0} jobs
                </Text>
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.valueText}>
                  {currentTab.format(value)}
                </Text>
                {change !== 0 && (
                  <View style={styles.changeInline}>
                    <Ionicons
                      name={change > 0 ? "arrow-up" : "arrow-down"}
                      size={10}
                      color={
                        change > 0
                          ? Theme.success
                          : Theme.destructive
                      }
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color:
                          change > 0
                            ? Theme.success
                            : Theme.destructive,
                      }}
                    >
                      {change > 0 ? "+" : ""}
                      {change}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>
        );
      }}
      ListEmptyComponent={
        sorted.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No rankings"
            description="Leaderboard data will appear here"
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  headerSection: {
    gap: 12,
    marginBottom: 12,
  },
  rangeRow: {
    flexDirection: "row",
    backgroundColor: Theme.muted,
    borderRadius: 10,
    padding: 3,
  },
  rangeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  rangeBtnActive: {
    backgroundColor: Theme.primary,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  rangeBtnTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  rankTabRow: {
    flexDirection: "row",
    gap: 6,
  },
  rankTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Theme.glassListItem,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rankTabActive: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  rankTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  rankTabTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  // Podium
  podiumSection: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  podiumCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Theme.glassCard,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  podiumCardFirst: {
    borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(251,191,36,0.05)",
  },
  podiumMedal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumName: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "center",
  },
  podiumValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.primary,
  },
  podiumRank: {
    fontSize: 11,
    color: Theme.zinc400,
    fontWeight: "500",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Incentive
  incentiveCard: {
    padding: 14,
  },
  incentiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  incentiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  incentiveTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  incentiveDesc: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  restTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  // List items
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
  valueCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  valueText: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.success,
  },
  changeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
