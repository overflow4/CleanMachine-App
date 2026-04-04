import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchInsightsData } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { CleanerPerformance } from "@/types";

export default function InsightsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["insights"],
    queryFn: fetchInsightsData,
  });

  const cleanerPerformance: CleanerPerformance[] =
    (data as any)?.cleanerPerformance ?? [];
  const messageAnalytics: any = (data as any)?.messageAnalytics ?? {};

  if (isLoading) return <LoadingScreen message="Loading insights..." />;

  return (
    <ScrollView
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <View className="p-4">
        {/* Message Analytics */}
        {messageAnalytics && Object.keys(messageAnalytics).length > 0 && (
          <Card className="mb-4">
            <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
              Message Analytics
            </Text>
            {Object.entries(messageAnalytics).map(([key, value]) => (
              <View key={key} className="flex-row justify-between border-b border-dark-100 py-2 dark:border-dark-700">
                <Text className="text-dark-500 dark:text-dark-400 capitalize">
                  {key.replace(/_/g, " ")}
                </Text>
                <Text className="font-medium text-dark-900 dark:text-white">
                  {typeof value === "number" ? value : String(value)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Cleaner Performance */}
        <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
          Cleaner Performance
        </Text>
        {cleanerPerformance.length === 0 ? (
          <EmptyState icon="analytics-outline" title="No data" description="Performance data will appear here" />
        ) : (
          cleanerPerformance.map((perf, i) => (
            <Card key={perf.cleaner_id || i} className="mb-2">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
                  <Text className="font-semibold text-cyan-600">{perf.cleaner_name?.[0]?.toUpperCase()}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-medium text-dark-900 dark:text-white">{perf.cleaner_name}</Text>
                  <Text className="text-sm text-dark-500 dark:text-dark-400">
                    {perf.jobs_completed} jobs • ${perf.revenue}
                  </Text>
                </View>
                <View className="items-end">
                  {perf.avg_rating != null && (
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text className="ml-1 text-sm font-medium text-dark-900 dark:text-white">
                        {perf.avg_rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {perf.upsell_rate != null && (
                    <Text className="text-xs text-dark-400">
                      {(perf.upsell_rate * 100).toFixed(0)}% upsell
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
