import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
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
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <View className="p-4">
        {campaigns.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No campaigns"
            description="Marketing campaigns will appear here"
          />
        ) : (
          campaigns.map((campaign, i) => (
            <Card key={campaign.id || i} className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-dark-900 dark:text-white">
                    {campaign.name}
                  </Text>
                  <Text className="mt-1 text-sm text-dark-500 dark:text-dark-400">
                    {campaign.type}
                  </Text>
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
              <View className="mt-3 flex-row justify-between">
                <View className="items-center">
                  <Text className="text-lg font-bold text-dark-900 dark:text-white">
                    {campaign.target_count}
                  </Text>
                  <Text className="text-xs text-dark-500 dark:text-dark-400">Target</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold text-primary-500">
                    {campaign.sent_count}
                  </Text>
                  <Text className="text-xs text-dark-500 dark:text-dark-400">Sent</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold text-green-600 dark:text-green-400">
                    {campaign.response_count}
                  </Text>
                  <Text className="text-xs text-dark-500 dark:text-dark-400">Responses</Text>
                </View>
              </View>
              <Text className="mt-2 text-xs text-dark-400">
                {new Date(campaign.created_at).toLocaleDateString()}
              </Text>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
