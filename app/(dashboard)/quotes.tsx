import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchQuotes, sendQuote } from "@/lib/api";
import { Quote } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

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
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={statusTabs}
        keyExtractor={(item) => item}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item)}
            style={[
              styles.filterChip,
              statusFilter === item ? styles.filterChipActive : styles.filterChipInactive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === item ? styles.filterChipTextActive : {},
              ]}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nameText}>
                  {item.customer_name || `Quote #${item.id.slice(-6)}`}
                </Text>
                <Text style={styles.subText}>{item.customer_phone || ""}</Text>
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
            <Text style={styles.totalText}>${item.total}</Text>
            {item.line_items && item.line_items.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {item.line_items.map((li, i) => (
                  <Text key={i} style={styles.lineItem}>
                    {"\u2022"} {li.description} ({li.quantity}x ${li.unit_price})
                  </Text>
                ))}
              </View>
            )}
            <Text style={styles.dateText}>
              Created {new Date(item.created_at).toLocaleDateString()}
              {item.valid_until && ` \u2022 Valid until ${new Date(item.valid_until).toLocaleDateString()}`}
            </Text>
            {(item.status === "draft" || item.status === "sent") && (
              <View style={{ marginTop: 8 }}>
                <Button
                  title={item.status === "draft" ? "Send Quote" : "Resend"}
                  variant="outline"
                  size="sm"
                  onPress={() => sendMutation.mutate(item.id)}
                  loading={sendMutation.isPending}
                />
              </View>
            )}
          </GlassCard>
        )}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No quotes" description="Quotes will appear here" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  filterList: {
    maxHeight: 48,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterChip: {
    marginHorizontal: 4,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: Theme.primary,
  },
  filterChipInactive: {
    backgroundColor: Theme.muted,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  filterChipTextActive: {
    color: "#ffffff",
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
  totalText: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: Theme.foreground,
  },
  lineItem: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
