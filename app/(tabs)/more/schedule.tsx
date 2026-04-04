import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchMyJobs, fetchCrews } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
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
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <View className="p-4">
        {/* View Mode Toggle */}
        <View className="mb-3 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
          {(["day", "week"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`flex-1 items-center rounded-md py-2 ${
                viewMode === mode ? "bg-white dark:bg-dark-700" : ""
              }`}
            >
              <Text className={`text-sm font-medium capitalize ${
                viewMode === mode ? "text-primary-500" : "text-dark-500 dark:text-dark-400"
              }`}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Nav */}
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigateDate(-1)}>
            <Ionicons name="chevron-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-dark-900 dark:text-white">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
            {dateRange?.end && ` — ${new Date(dateRange.end + "T12:00:00").toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            })}`}
          </Text>
          <TouchableOpacity onPress={() => navigateDate(1)}>
            <Ionicons name="chevron-forward" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* Jobs */}
        {jobs.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No jobs scheduled" description="No jobs for this period" />
        ) : (
          jobs.map((job, i) => (
            <Card key={job.id || i} className="mb-2">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    {job.customer_name || job.phone_number || "Job"}
                  </Text>
                  <Text className="text-sm text-dark-500 dark:text-dark-400">
                    {job.scheduled_time || job.scheduled_at || ""} • {job.service_type || "Service"}
                  </Text>
                  {job.address && (
                    <Text className="text-xs text-dark-400" numberOfLines={1}>{job.address}</Text>
                  )}
                </View>
                <Badge
                  label={job.status || "scheduled"}
                  variant={job.status === "completed" ? "success" : job.status === "cancelled" ? "error" : "default"}
                />
              </View>
              {job.price != null && (
                <Text className="mt-1 text-sm font-medium text-green-600">${job.price}</Text>
              )}
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
