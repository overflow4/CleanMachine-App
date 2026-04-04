import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchMemberships } from "@/lib/api";
import { Membership } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MembershipsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => fetchMemberships(),
  });

  const memberships: Membership[] = (data as any)?.memberships ?? (data as any)?.data ?? [];

  if (isLoading) return <LoadingScreen message="Loading memberships..." />;

  return (
    <FlatList
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      data={memberships}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      renderItem={({ item }) => (
        <Card className="mb-2">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="font-medium text-dark-900 dark:text-white">
                {item.customer?.first_name
                  ? `${item.customer.first_name} ${item.customer.last_name || ""}`
                  : `Customer #${item.customer_id}`}
              </Text>
              <Text className="text-sm text-dark-500 dark:text-dark-400">
                {item.service_plan?.name || "Plan"} — ${item.service_plan?.price ?? 0}/{item.service_plan?.frequency || "month"}
              </Text>
            </View>
            <Badge
              label={item.status}
              variant={item.status === "active" ? "success" : item.status === "cancelled" ? "error" : "warning"}
            />
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-sm text-dark-500 dark:text-dark-400">
              Visits: {item.visits_used ?? 0}/{item.visits_total ?? 0}
            </Text>
            {item.next_renewal && (
              <Text className="text-sm text-dark-500 dark:text-dark-400">
                Renews: {new Date(item.next_renewal).toLocaleDateString()}
              </Text>
            )}
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <EmptyState icon="card-outline" title="No memberships" description="Memberships will appear here" />
      }
    />
  );
}
