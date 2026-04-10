import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchExceptions, apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { AttentionItem } from "@/types";

export default function ExceptionsScreen() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<AttentionItem | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["exceptions"],
    queryFn: fetchExceptions,
  });

  const exceptions: AttentionItem[] = (data as any)?.items ?? [];

  const resolveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/actions/attention-needed", {
        method: "POST",
        body: JSON.stringify({ id, action: "resolve" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      setSelectedItem(null);
      Alert.alert("Success", "Exception resolved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/actions/attention-needed", {
        method: "POST",
        body: JSON.stringify({ id, action: "dismiss" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      setSelectedItem(null);
      Alert.alert("Success", "Exception dismissed");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleResolve = () => {
    if (!selectedItem) return;
    resolveMutation.mutate(selectedItem.id);
  };

  const handleDismiss = () => {
    if (!selectedItem) return;
    Alert.alert(
      "Dismiss Exception",
      "Are you sure you want to dismiss this exception? It will be removed from your attention list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          style: "destructive",
          onPress: () => dismissMutation.mutate(selectedItem.id),
        },
      ]
    );
  };

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
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={exceptions}
        keyExtractor={(item, i) => item.id || i.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedItem(item)}>
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
                  <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState icon="checkmark-circle-outline" title="No exceptions" description="All clear!" />
        }
      />

      {/* Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title="Exception Details"
      >
        {selectedItem && (
          <View>
            {/* Header with icon and priority */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailIconWrap, {
                backgroundColor: selectedItem.priority === "high" ? Theme.destructiveBg : Theme.warningBg,
              }]}>
                <Ionicons
                  name={typeIcons[selectedItem.type] || "alert-circle-outline"}
                  size={28}
                  color={selectedItem.priority === "high" ? Theme.destructive : Theme.warning}
                />
              </View>
              <Badge
                label={selectedItem.priority}
                variant={selectedItem.priority === "high" ? "error" : "warning"}
              />
            </View>

            {/* Title */}
            <Text style={styles.detailTitle}>{selectedItem.title}</Text>

            {/* Type */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{selectedItem.type?.replace(/_/g, " ") || "Unknown"}</Text>
            </View>

            {/* Description */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValueFull}>{selectedItem.description}</Text>
            </View>

            {/* Customer info */}
            {(selectedItem as any).customer_name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{(selectedItem as any).customer_name}</Text>
              </View>
            )}

            {/* Job info */}
            {(selectedItem as any).job_id && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job ID</Text>
                <Text style={styles.detailValue}>#{(selectedItem as any).job_id}</Text>
              </View>
            )}

            {(selectedItem as any).job_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job Date</Text>
                <Text style={styles.detailValue}>{new Date((selectedItem as any).job_date).toLocaleDateString()}</Text>
              </View>
            )}

            {/* Created at */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{new Date(selectedItem.created_at).toLocaleString()}</Text>
            </View>

            {/* Additional data fields */}
            {(selectedItem as any).metadata && typeof (selectedItem as any).metadata === "object" && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Details</Text>
                <Text style={styles.detailValueFull}>
                  {Object.entries((selectedItem as any).metadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.detailActions}>
              <ActionButton
                title="Resolve"
                onPress={handleResolve}
                variant="primary"
                loading={resolveMutation.isPending}
              />
              <ActionButton
                title="Dismiss"
                onPress={handleDismiss}
                variant="danger"
                loading={dismissMutation.isPending}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
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
  // Detail Modal styles
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: Theme.foreground,
  },
  detailValueFull: {
    fontSize: 14,
    color: Theme.foreground,
    lineHeight: 20,
  },
  detailActions: {
    marginTop: 20,
    gap: 10,
  },
});
