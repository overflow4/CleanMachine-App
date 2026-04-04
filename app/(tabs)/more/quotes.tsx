import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchQuotes, sendQuote } from "@/lib/api";
import { Quote } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

const statusTabs = ["all", "draft", "sent", "viewed", "accepted", "declined", "expired"];

export default function QuotesScreen() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () => fetchQuotes(statusFilter === "all" ? {} : { status: statusFilter }),
  });

  const quotes: Quote[] = (data as any)?.quotes ?? (data as any)?.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (quoteId: string) => sendQuote(quoteId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      Alert.alert("Success", "Quote sent");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  if (isLoading) return <LoadingScreen message="Loading quotes..." />;

  return (
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={statusTabs}
        keyExtractor={(item) => item}
        className="max-h-12 px-2 pt-2"
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item)}
            className={`mx-1 rounded-full px-4 py-2 ${
              statusFilter === item ? "bg-primary-500" : "bg-dark-200 dark:bg-dark-700"
            }`}
          >
            <Text className={`text-sm font-medium capitalize ${
              statusFilter === item ? "text-white" : "text-dark-700 dark:text-dark-300"
            }`}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        className="px-4 pt-2"
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-medium text-dark-900 dark:text-white">
                  {item.customer_name || `Quote #${item.id.slice(-6)}`}
                </Text>
                <Text className="text-sm text-dark-500 dark:text-dark-400">
                  {item.customer_phone || ""}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={
                  item.status === "accepted" ? "success" :
                  item.status === "declined" || item.status === "expired" ? "error" :
                  item.status === "sent" || item.status === "viewed" ? "info" : "default"
                }
              />
            </View>
            <Text className="mt-2 text-xl font-bold text-dark-900 dark:text-white">${item.total}</Text>
            {item.line_items && item.line_items.length > 0 && (
              <View className="mt-2">
                {item.line_items.map((li, i) => (
                  <Text key={i} className="text-sm text-dark-500 dark:text-dark-400">
                    • {li.description} ({li.quantity}x ${li.unit_price})
                  </Text>
                ))}
              </View>
            )}
            <Text className="mt-1 text-xs text-dark-400">
              Created {new Date(item.created_at).toLocaleDateString()}
              {item.valid_until && ` • Valid until ${new Date(item.valid_until).toLocaleDateString()}`}
            </Text>
            {(item.status === "draft" || item.status === "sent") && (
              <View className="mt-2">
                <Button
                  title={item.status === "draft" ? "Send Quote" : "Resend"}
                  variant="outline"
                  size="sm"
                  onPress={() => sendMutation.mutate(item.id)}
                  loading={sendMutation.isPending}
                />
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No quotes" description="Quotes will appear here" />
        }
      />
    </View>
  );
}
