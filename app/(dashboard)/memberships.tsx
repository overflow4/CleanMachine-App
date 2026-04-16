import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchMemberships,
  apiFetch,
  fetchServicePlans,
  lookupCustomer,
} from "@/lib/api";
import { Membership, ServicePlan } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

type StatusFilter = "all" | "active" | "paused" | "cancelled";
type RenewalState = "awaiting_reply" | "renewing" | "declined";

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "list-outline" },
  { key: "active", label: "Active", icon: "checkmark-circle-outline" },
  { key: "paused", label: "Paused", icon: "pause-circle-outline" },
  { key: "cancelled", label: "Cancelled", icon: "close-circle-outline" },
];

const RENEWAL_COLORS: Record<RenewalState, { bg: string; text: string }> = {
  awaiting_reply: { bg: Theme.infoBg, text: Theme.info },
  renewing: { bg: Theme.successBg, text: Theme.success },
  declined: { bg: Theme.destructiveBg, text: Theme.destructive },
};

export default function MembershipsScreen() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create modal state
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => fetchMemberships(),
  });

  const { data: plansData } = useQuery({
    queryKey: ["service-plans"],
    queryFn: fetchServicePlans,
  });

  const memberships: Membership[] =
    (data as any)?.memberships ?? (data as any)?.data ?? [];
  const servicePlans: ServicePlan[] =
    (plansData as any)?.plans ?? (plansData as any)?.data ?? [];

  // Filter and search
  const filtered = useMemo(() => {
    let list = memberships;
    if (statusFilter !== "all") {
      list = list.filter(
        (m) => (m.status || "").toLowerCase() === statusFilter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => {
        const name = [
          m.customer?.first_name,
          m.customer?.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const phone = m.customer?.phone_number?.toLowerCase() || "";
        return name.includes(q) || phone.includes(q);
      });
    }
    return list;
  }, [memberships, statusFilter, search]);

  // Status summary counts
  const counts = useMemo(() => {
    const c = { all: memberships.length, active: 0, paused: 0, cancelled: 0 };
    memberships.forEach((m) => {
      const s = (m.status || "").toLowerCase();
      if (s === "active") c.active++;
      else if (s === "paused") c.paused++;
      else if (s === "cancelled") c.cancelled++;
    });
    return c;
  }, [memberships]);

  // Mutations
  const membershipActionMutation = useMutation({
    mutationFn: ({
      membership_id,
      action,
    }: {
      membership_id: string;
      action: "pause" | "resume" | "cancel";
    }) =>
      apiFetch("/api/actions/memberships", {
        method: "POST",
        body: JSON.stringify({ membership_id, action }),
      }),
    onSuccess: (_data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      const labels: Record<string, string> = {
        pause: "paused",
        resume: "resumed",
        cancel: "cancelled",
      };
      Alert.alert("Success", `Membership ${labels[variables.action]}`);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createMutation = useMutation({
    mutationFn: (body: { customer_id: string; service_plan_id: string }) =>
      apiFetch("/api/actions/memberships", {
        method: "POST",
        body: JSON.stringify({ ...body, action: "create" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      setShowCreateModal(false);
      resetCreateForm();
      Alert.alert("Success", "Membership created");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const resetCreateForm = () => {
    setLookupPhone("");
    setLookupResult(null);
    setSelectedPlanId("");
  };

  const handleAction = (
    membershipId: string,
    action: "pause" | "resume" | "cancel"
  ) => {
    if (action === "cancel") {
      Alert.alert(
        "Cancel Membership",
        "Are you sure you want to cancel this membership? This action cannot be undone.",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Membership",
            style: "destructive",
            onPress: () =>
              membershipActionMutation.mutate({
                membership_id: membershipId,
                action,
              }),
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
            onPress: () =>
              membershipActionMutation.mutate({
                membership_id: membershipId,
                action,
              }),
          },
        ]
      );
    } else {
      membershipActionMutation.mutate({
        membership_id: membershipId,
        action,
      });
    }
  };

  const handlePhoneLookup = async () => {
    if (!lookupPhone.trim()) return;
    setLookupLoading(true);
    try {
      const result = await lookupCustomer({ phone: lookupPhone.trim() });
      const customer =
        (result as any)?.customer ?? (result as any)?.data ?? null;
      setLookupResult(customer);
      if (!customer) {
        Alert.alert("Not Found", "No customer found with that phone number.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateMembership = () => {
    if (!lookupResult?.id) {
      Alert.alert("Error", "Please look up a customer first.");
      return;
    }
    if (!selectedPlanId) {
      Alert.alert("Error", "Please select a service plan.");
      return;
    }
    createMutation.mutate({
      customer_id: lookupResult.id,
      service_plan_id: selectedPlanId,
    });
  };

  const getActionButtons = (item: Membership) => {
    const status = (item.status || "").toLowerCase();
    const buttons: {
      label: string;
      action: "pause" | "resume" | "cancel";
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
      bg: string;
    }[] = [];

    if (status === "active") {
      buttons.push({
        label: "Pause",
        action: "pause",
        icon: "pause-circle-outline",
        color: Theme.warning,
        bg: Theme.warningBg,
      });
      buttons.push({
        label: "Cancel",
        action: "cancel",
        icon: "close-circle-outline",
        color: Theme.destructive,
        bg: Theme.destructiveBg,
      });
    } else if (status === "paused") {
      buttons.push({
        label: "Resume",
        action: "resume",
        icon: "play-circle-outline",
        color: Theme.success,
        bg: Theme.successBg,
      });
      buttons.push({
        label: "Cancel",
        action: "cancel",
        icon: "close-circle-outline",
        color: Theme.destructive,
        bg: Theme.destructiveBg,
      });
    }

    return buttons;
  };

  const getRenewalState = (item: Membership): RenewalState | null => {
    const raw = (item as any).renewal_state;
    if (raw && RENEWAL_COLORS[raw as RenewalState]) return raw as RenewalState;
    return null;
  };

  const getVisitsProgress = (item: Membership) => {
    const used = item.visits_used ?? 0;
    const total = item.visits_total ?? 0;
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    return { used, total, pct };
  };

  if (isLoading) return <LoadingScreen message="Loading memberships..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Status summary */}
            <View style={styles.metricsRow}>
              <MetricCard
                title="Active"
                value={counts.active}
                icon="checkmark-circle-outline"
                iconColor={Theme.success}
                compact
              />
              <MetricCard
                title="Paused"
                value={counts.paused}
                icon="pause-circle-outline"
                iconColor={Theme.warning}
                compact
              />
              <MetricCard
                title="Cancelled"
                value={counts.cancelled}
                icon="close-circle-outline"
                iconColor={Theme.destructive}
                compact
              />
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons
                name="search"
                size={16}
                color={Theme.mutedForeground}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or phone..."
                placeholderTextColor={Theme.mutedForeground}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Theme.zinc500}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Status filter */}
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterBtn,
                      active && styles.filterBtnActive,
                    ]}
                    onPress={() => setStatusFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={f.icon}
                      size={14}
                      color={active ? Theme.primary : Theme.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.filterBtnText,
                        active && styles.filterBtnTextActive,
                      ]}
                    >
                      {f.label} ({counts[f.key]})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const actions = getActionButtons(item);
          const isPending = membershipActionMutation.isPending;
          const renewalState = getRenewalState(item);
          const visits = getVisitsProgress(item);

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
                    {item.service_plan?.name || "Plan"} — $
                    {item.service_plan?.price ?? 0}/
                    {item.service_plan?.frequency || "month"}
                  </Text>
                </View>
                <View style={styles.badgeCol}>
                  <Badge
                    label={item.status}
                    variant={
                      item.status === "active"
                        ? "success"
                        : item.status === "cancelled"
                          ? "error"
                          : "warning"
                    }
                  />
                  {renewalState && (
                    <View
                      style={[
                        styles.renewalBadge,
                        {
                          backgroundColor:
                            RENEWAL_COLORS[renewalState].bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.renewalBadgeText,
                          {
                            color:
                              RENEWAL_COLORS[renewalState].text,
                          },
                        ]}
                      >
                        {renewalState.replace(/_/g, " ")}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Visits progress */}
              <View style={styles.visitsSection}>
                <View style={styles.visitsHeader}>
                  <Text style={styles.metaText}>
                    Visits: {visits.used}/{visits.total}
                  </Text>
                  {item.next_renewal && (
                    <Text style={styles.metaText}>
                      Renews:{" "}
                      {new Date(item.next_renewal).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${visits.pct}%`,
                        backgroundColor:
                          visits.pct >= 80
                            ? Theme.warning
                            : Theme.primary,
                      },
                    ]}
                  />
                </View>
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
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: btn.bg,
                          opacity: isPending ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={btn.icon}
                        size={16}
                        color={btn.color}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: btn.color },
                        ]}
                      >
                        {btn.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </GlassCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="card-outline"
            title="No memberships"
            description={
              statusFilter !== "all"
                ? `No ${statusFilter} memberships found`
                : "Memberships will appear here"
            }
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => {
          resetCreateForm();
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Membership Modal */}
      <Modal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Membership"
      >
        {/* Phone lookup */}
        <Text style={styles.modalSectionTitle}>Customer Lookup</Text>
        <View style={styles.lookupRow}>
          <View style={{ flex: 1 }}>
            <InputField
              label="Phone Number"
              value={lookupPhone}
              onChangeText={setLookupPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            style={styles.lookupBtn}
            onPress={handlePhoneLookup}
            disabled={lookupLoading}
          >
            {lookupLoading ? (
              <Text style={styles.lookupBtnText}>...</Text>
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {lookupResult && (
          <GlassCard style={styles.lookupResultCard}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={Theme.success}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.lookupName}>
                {lookupResult.first_name} {lookupResult.last_name || ""}
              </Text>
              <Text style={styles.lookupPhone}>
                {lookupResult.phone_number}
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Plan selector */}
        <Text style={styles.modalSectionTitle}>Select Plan</Text>
        {servicePlans.length === 0 ? (
          <Text style={styles.emptyPlansText}>
            No service plans available.
          </Text>
        ) : (
          servicePlans.map((plan) => {
            const selected = selectedPlanId === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planOption,
                  selected && styles.planOptionSelected,
                ]}
                onPress={() => setSelectedPlanId(plan.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    selected
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={selected ? Theme.primary : Theme.zinc500}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDetails}>
                    ${plan.price}/{plan.frequency} - {plan.visits}{" "}
                    visits
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ marginTop: 8 }}>
          <ActionButton
            title="Create Membership"
            onPress={handleCreateMembership}
            variant="primary"
            loading={createMutation.isPending}
            disabled={!lookupResult || !selectedPlanId}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  headerSection: {
    marginBottom: 12,
    gap: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.foreground,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  filterBtnActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  filterBtnTextActive: {
    color: Theme.primary,
  },
  card: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  badgeCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  renewalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  renewalBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  visitsSection: {
    gap: 6,
  },
  visitsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.muted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
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
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  // Modal styles
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 4,
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  lookupBtn: {
    backgroundColor: Theme.primary,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  lookupBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  lookupResultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  lookupName: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
  },
  lookupPhone: {
    fontSize: 12,
    color: Theme.mutedForeground,
  },
  emptyPlansText: {
    fontSize: 13,
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingVertical: 12,
  },
  planOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.glassListItem,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planOptionSelected: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  planName: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
  },
  planDetails: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 1,
  },
});
