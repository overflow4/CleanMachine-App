import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchEarnings } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

type Period = "today" | "week" | "month";

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>("today");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["earnings", period],
    queryFn: () => fetchEarnings(period),
  });

  const earnings: any = data ?? {};

  if (isLoading) return <LoadingScreen message="Loading earnings..." />;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <ScrollView
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      {/* Period Selector */}
      <View className="mx-4 mt-3 mb-4 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            className={`flex-1 items-center rounded-md py-2.5 ${
              period === p.key ? "bg-white dark:bg-dark-700" : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                period === p.key
                  ? "text-primary-500"
                  : "text-dark-500 dark:text-dark-400"
              }`}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-4">
        {/* Revenue Stats */}
        <View className="mb-4 flex-row gap-3">
          <StatCard
            title="Total Revenue"
            value={`$${earnings.total_revenue ?? earnings.revenue ?? 0}`}
            icon="cash-outline"
            iconColor="#22c55e"
          />
          <StatCard
            title="Jobs Completed"
            value={earnings.jobs_completed ?? earnings.completed_jobs ?? 0}
            icon="checkmark-circle-outline"
            iconColor="#3b82f6"
          />
        </View>

        <View className="mb-4 flex-row gap-3">
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
            iconColor="#f59e0b"
          />
        </View>

        {/* Breakdown */}
        {earnings.breakdown && Array.isArray(earnings.breakdown) && (
          <View className="mb-4">
            <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
              Breakdown
            </Text>
            {earnings.breakdown.map((item: any, i: number) => (
              <Card key={i} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-medium text-dark-900 dark:text-white">
                      {item.label || item.name || `Item ${i + 1}`}
                    </Text>
                    <Text className="text-sm text-dark-500 dark:text-dark-400">
                      {item.count ?? 0} jobs
                    </Text>
                  </View>
                  <Text className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${item.amount ?? item.total ?? 0}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
