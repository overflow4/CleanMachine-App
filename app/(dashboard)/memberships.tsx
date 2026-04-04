import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchMemberships } from "@/lib/api";
import { Membership } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

export default function MembershipsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => fetchMemberships(),
  });

  const memberships: Membership[] = (data as any)?.memberships ?? (data as any)?.data ?? [];

  if (isLoading) return <LoadingScreen message="Loading memberships..." />;

  return (
    <FlatList
      style={styles.container}
      data={memberships}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      renderItem={({ item }) => (
        <GlassCard style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nameText}>
                {item.customer?.first_name
                  ? `${item.customer.first_name} ${item.customer.last_name || ""}`
                  : `Customer #${item.customer_id}`}
              </Text>
              <Text style={styles.subText}>
                {item.service_plan?.name || "Plan"} — ${item.service_plan?.price ?? 0}/{item.service_plan?.frequency || "month"}
              </Text>
            </View>
            <Badge
              label={item.status}
              variant={item.status === "active" ? "success" : item.status === "cancelled" ? "error" : "warning"}
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Visits: {item.visits_used ?? 0}/{item.visits_total ?? 0}
            </Text>
            {item.next_renewal && (
              <Text style={styles.metaText}>
                Renews: {new Date(item.next_renewal).toLocaleDateString()}
              </Text>
            )}
          </View>
        </GlassCard>
      )}
      ListEmptyComponent={
        <EmptyState icon="card-outline" title="No memberships" description="Memberships will appear here" />
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
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
});
