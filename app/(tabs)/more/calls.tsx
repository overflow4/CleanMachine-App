import React from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchCalls } from "@/lib/api";
import { CallRecord } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CallsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["calls"],
    queryFn: fetchCalls,
  });

  const calls: CallRecord[] = (data as any)?.data ?? (data as any)?.calls ?? [];

  if (isLoading) return <LoadingScreen message="Loading calls..." />;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <FlatList
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      data={calls}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      renderItem={({ item }) => (
        <Card className="mb-2">
          <View className="flex-row items-start">
            <View className={`h-10 w-10 items-center justify-center rounded-full ${
              item.direction === "inbound" ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"
            }`}>
              <Ionicons
                name={item.direction === "inbound" ? "call-outline" : "arrow-redo-outline"}
                size={20}
                color={item.direction === "inbound" ? "#22c55e" : "#3b82f6"}
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-medium text-dark-900 dark:text-white">
                {item.customer_name || item.phone_number}
              </Text>
              <Text className="text-sm text-dark-500 dark:text-dark-400">
                {item.direction} • {formatDuration(item.duration_seconds)}
              </Text>
              {item.outcome && (
                <Badge
                  label={item.outcome}
                  variant={item.outcome === "booked" ? "success" : item.outcome === "no_answer" ? "error" : "default"}
                />
              )}
              {item.transcript && (
                <Text className="mt-2 text-sm text-dark-600 dark:text-dark-300" numberOfLines={3}>
                  {item.transcript}
                </Text>
              )}
              <Text className="mt-1 text-xs text-dark-400">
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {item.recording_url && (
              <TouchableOpacity onPress={() => Linking.openURL(item.recording_url!)}>
                <Ionicons name="play-circle-outline" size={28} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <EmptyState icon="call-outline" title="No calls" description="Call logs will appear here" />
      }
    />
  );
}
