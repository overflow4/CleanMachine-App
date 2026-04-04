import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { fetchMetrics, fetchJobs, fetchAttentionNeeded } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { Job, AttentionItem } from "@/types";

export default function OverviewScreen() {
  const { user, tenant } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const metricsQuery = useQuery({
    queryKey: ["metrics", "today"],
    queryFn: () => fetchMetrics("today"),
  });

  const todaysJobsQuery = useQuery({
    queryKey: ["jobs", "today"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0];
      return fetchJobs({ date: today });
    },
  });

  const attentionQuery = useQuery({
    queryKey: ["attention-needed"],
    queryFn: fetchAttentionNeeded,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      metricsQuery.refetch(),
      todaysJobsQuery.refetch(),
      attentionQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const metrics: any = metricsQuery.data ?? {};
  const jobs: Job[] = (todaysJobsQuery.data as any)?.data ?? (todaysJobsQuery.data as any)?.jobs ?? [];
  const attentionItems: AttentionItem[] = (attentionQuery.data as any)?.items ?? [];

  if (metricsQuery.isLoading && !metricsQuery.data) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        <Text className="mb-1 text-2xl font-bold text-dark-900 dark:text-white">
          Command Center
        </Text>
        <Text className="mb-4 text-dark-500 dark:text-dark-400">
          Welcome back, {user?.display_name || user?.username}
        </Text>

        {/* Stats */}
        <View className="mb-4 flex-row gap-3">
          <StatCard
            title="Revenue Today"
            value={`$${metrics.revenue ?? metrics.today_revenue ?? 0}`}
            icon="cash-outline"
            iconColor="#22c55e"
          />
          <StatCard
            title="Jobs Today"
            value={metrics.jobs ?? metrics.today_jobs ?? 0}
            icon="briefcase-outline"
            iconColor="#3b82f6"
          />
        </View>
        <View className="mb-6 flex-row gap-3">
          <StatCard
            title="New Leads"
            value={metrics.leads ?? metrics.new_leads ?? 0}
            icon="trending-up-outline"
            iconColor="#f59e0b"
          />
          <StatCard
            title="Active Teams"
            value={metrics.active_teams ?? 0}
            icon="people-outline"
            iconColor="#8b5cf6"
          />
        </View>

        {/* Attention Needed */}
        {attentionItems.length > 0 && (
          <View className="mb-6">
            <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
              Attention Needed
            </Text>
            {attentionItems.slice(0, 5).map((item, index) => (
              <Card key={item.id || index} className="mb-2">
                <View className="flex-row items-center">
                  <Ionicons
                    name={
                      item.type === "payment"
                        ? "card-outline"
                        : item.type === "message"
                        ? "chatbubble-outline"
                        : item.type === "unassigned"
                        ? "person-add-outline"
                        : "alert-circle-outline"
                    }
                    size={20}
                    color={item.priority === "high" ? "#ef4444" : "#f59e0b"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-dark-900 dark:text-white">
                      {item.title}
                    </Text>
                    <Text className="text-sm text-dark-500 dark:text-dark-400">
                      {item.description}
                    </Text>
                  </View>
                  <Badge
                    label={item.priority}
                    variant={item.priority === "high" ? "error" : "warning"}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Today's Jobs */}
        <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
          Today's Jobs
        </Text>
        {jobs.length === 0 ? (
          <Card>
            <Text className="text-center text-dark-500 dark:text-dark-400">
              No jobs scheduled for today
            </Text>
          </Card>
        ) : (
          jobs.slice(0, 10).map((job, index) => (
            <Card key={job.id || index} className="mb-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    {job.customer_name || job.phone_number || "Unnamed Job"}
                  </Text>
                  <Text className="text-sm text-dark-500 dark:text-dark-400">
                    {job.scheduled_time || job.scheduled_at || ""} • {job.service_type || "Service"}
                  </Text>
                  {job.address && (
                    <Text className="text-xs text-dark-400 dark:text-dark-500" numberOfLines={1}>
                      {job.address}
                    </Text>
                  )}
                </View>
                <Badge
                  label={job.status || "scheduled"}
                  variant={
                    job.status === "completed"
                      ? "success"
                      : job.status === "in_progress" || job.status === "in-progress"
                      ? "info"
                      : job.status === "cancelled"
                      ? "error"
                      : "default"
                  }
                />
              </View>
              {job.price != null && (
                <Text className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                  ${job.price}
                </Text>
              )}
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
