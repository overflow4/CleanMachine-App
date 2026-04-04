import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchExceptions } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { AttentionItem } from "@/types";

export default function ExceptionsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["exceptions"],
    queryFn: fetchExceptions,
  });

  const exceptions: AttentionItem[] = (data as any)?.items ?? [];

  if (isLoading) return <LoadingScreen message="Loading exceptions..." />;

  const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    no_team_confirm: "people-outline",
    high_value: "cash-outline",
    routing_error: "navigate-outline",
    payment: "card-outline",
    message: "chatbubble-outline",
    unassigned: "person-add-outline",
    cleaner: "person-outline",
    quote: "document-text-outline",
  };

  return (
    <FlatList
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      data={exceptions}
      keyExtractor={(item, i) => item.id || i.toString()}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      renderItem={({ item }) => (
        <Card className="mb-2">
          <View className="flex-row items-start">
            <Ionicons
              name={typeIcons[item.type] || "alert-circle-outline"}
              size={24}
              color={item.priority === "high" ? "#ef4444" : "#f59e0b"}
            />
            <View className="ml-3 flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-medium text-dark-900 dark:text-white">{item.title}</Text>
                <Badge
                  label={item.priority}
                  variant={item.priority === "high" ? "error" : "warning"}
                />
              </View>
              <Text className="mt-1 text-sm text-dark-500 dark:text-dark-400">{item.description}</Text>
              <Text className="mt-1 text-xs text-dark-400">
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <EmptyState icon="checkmark-circle-outline" title="No exceptions" description="All clear!" />
      }
    />
  );
}
