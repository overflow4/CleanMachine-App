import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchMyJobs, fetchCrews } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

type ViewMode = "day" | "week";

export default function ScheduleScreen() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-jobs", date, viewMode],
    queryFn: () => fetchMyJobs(date, viewMode),
  });

  const crewsQuery = useQuery({
    queryKey: ["crews", date, viewMode],
    queryFn: () => fetchCrews(date, viewMode === "week"),
  });

  const jobs: Job[] = (data as any)?.jobs ?? [];
  const dateRange = (data as any)?.dateRange;

  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + (viewMode === "week" ? 7 * dir : dir));
    setDate(d.toISOString().split("T")[0]);
  };

  if (isLoading) return <LoadingScreen message="Loading schedule..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      <View style={styles.content}>
        {/* View Mode Toggle */}
        <View style={styles.tabBar}>
          {(["day", "week"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.tab, viewMode === mode && styles.tabActive]}
            >
              <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateDate(-1)}>
            <Ionicons name="chevron-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
            {dateRange?.end && ` \u2014 ${new Date(dateRange.end + "T12:00:00").toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            })}`}
          </Text>
          <TouchableOpacity onPress={() => navigateDate(1)}>
            <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Jobs */}
        {jobs.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No jobs scheduled" description="No jobs for this period" />
        ) : (
          jobs.map((job, i) => (
            <GlassCard key={job.id || i} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {job.customer_name || job.phone_number || "Job"}
                  </Text>
                  <Text style={styles.subText}>
                    {job.scheduled_time || job.scheduled_at || ""} {"\u2022"} {job.service_type || "Service"}
                  </Text>
                  {job.address && (
                    <Text style={styles.addressText} numberOfLines={1}>{job.address}</Text>
                  )}
                </View>
                <Badge
                  label={job.status || "scheduled"}
                  variant={job.status === "completed" ? "success" : job.status === "cancelled" ? "error" : "default"}
                />
              </View>
              {job.price != null && (
                <Text style={styles.priceText}>${job.price}</Text>
              )}
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
  tabBar: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 8,
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
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  card: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  addressText: {
    fontSize: 11,
    color: Theme.zinc400,
  },
  priceText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.success,
  },
});
