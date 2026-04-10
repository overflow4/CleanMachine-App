import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchMemberships, apiFetch } from "@/lib/api";
import { Membership } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

export default function MembershipsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => fetchMemberships(),
  });

  const memberships: Membership[] = (data as any)?.memberships ?? (data as any)?.data ?? [];

  const membershipActionMutation = useMutation({
    mutationFn: ({ membership_id, action }: { membership_id: string; action: "pause" | "resume" | "cancel" }) =>
      apiFetch("/api/actions/memberships", {
        method: "POST",
        body: JSON.stringify({ membership_id, action }),
      }),
    onSuccess: (_data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      const labels: Record<string, string> = { pause: "paused", resume: "resumed", cancel: "cancelled" };
      Alert.alert("Success", `Membership ${labels[variables.action]}`);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleAction = (membershipId: string, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel") {
      Alert.alert(
        "Cancel Membership",
        "Are you sure you want to cancel this membership? This action cannot be undone.",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Membership",
            style: "destructive",
            onPress: () => membershipActionMutation.mutate({ membership_id: membershipId, action }),
          },
        ]
      );
    } else if (action === "pause") {
      Alert.alert(
        "Pause Membership",
        "Are you sure you want to pause this membership?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Pause",
            onPress: () => membershipActionMutation.mutate({ membership_id: membershipId, action }),
          },
        ]
      );
    } else {
      membershipActionMutation.mutate({ membership_id: membershipId, action });
    }
  };

  if (isLoading) return <LoadingScreen message="Loading memberships..." />;

  const getActionButtons = (item: Membership) => {
    const status = (item.status || "").toLowerCase();
    const buttons: { label: string; action: "pause" | "resume" | "cancel"; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [];

    if (status === "active") {
      buttons.push({ label: "Pause", action: "pause", icon: "pause-circle-outline", color: Theme.warning, bg: Theme.warningBg });
      buttons.push({ label: "Cancel", action: "cancel", icon: "close-circle-outline", color: Theme.destructive, bg: Theme.destructiveBg });
    } else if (status === "paused") {
      buttons.push({ label: "Resume", action: "resume", icon: "play-circle-outline", color: Theme.success, bg: Theme.successBg });
      buttons.push({ label: "Cancel", action: "cancel", icon: "close-circle-outline", color: Theme.destructive, bg: Theme.destructiveBg });
    }

    return buttons;
  };

  return (
    <FlatList
      style={styles.container}
      data={memberships}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      renderItem={({ item }) => {
        const actions = getActionButtons(item);
        const isPending = membershipActionMutation.isPending;

        return (
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

            {/* Action Buttons */}
            {actions.length > 0 && (
              <View style={styles.actionsRow}>
                {actions.map((btn) => (
                  <TouchableOpacity
                    key={btn.action}
                    onPress={() => handleAction(item.id, btn.action)}
                    disabled={isPending}
                    activeOpacity={0.7}
                    style={[styles.actionBtn, { backgroundColor: btn.bg, opacity: isPending ? 0.5 : 1 }]}
                  >
                    <Ionicons name={btn.icon} size={16} color={btn.color} />
                    <Text style={[styles.actionBtnText, { color: btn.color }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </GlassCard>
        );
      }}
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
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
