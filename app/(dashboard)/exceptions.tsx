import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchExceptions } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
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
      style={styles.container}
      data={exceptions}
      keyExtractor={(item, i) => item.id || i.toString()}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      renderItem={({ item }) => (
        <GlassCard style={styles.card}>
          <View style={styles.rowStart}>
            <Ionicons
              name={typeIcons[item.type] || "alert-circle-outline"}
              size={24}
              color={item.priority === "high" ? Theme.destructive : Theme.warning}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.titleText}>{item.title}</Text>
                <Badge
                  label={item.priority}
                  variant={item.priority === "high" ? "error" : "warning"}
                />
              </View>
              <Text style={styles.descText}>{item.description}</Text>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
        </GlassCard>
      )}
      ListEmptyComponent={
        <EmptyState icon="checkmark-circle-outline" title="No exceptions" description="All clear!" />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  card: {
    marginBottom: 8,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
    marginRight: 8,
  },
  descText: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
