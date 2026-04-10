import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchLeads, fetchPipeline, apiFetch } from "@/lib/api";
import { Lead, LeadStatus, LeadSource, PipelineStage } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

// ===== CONSTANTS =====

const statusTabs: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "booked", label: "Booked" },
  { key: "nurturing", label: "Nurturing" },
  { key: "escalated", label: "Escalated" },
  { key: "lost", label: "Lost" },
];

const statusChips: { key: LeadStatus; label: string; color: string }[] = [
  { key: "new", label: "New", color: Theme.primary },
  { key: "contacted", label: "Contacted", color: "#6366f1" },
  { key: "qualified", label: "Qualified", color: "#f59e0b" },
  { key: "booked", label: "Booked", color: Theme.success },
  { key: "nurturing", label: "Nurturing", color: "#8b5cf6" },
  { key: "escalated", label: "Escalated", color: "#ef4444" },
  { key: "lost", label: "Lost", color: Theme.mutedForeground },
];

const sourceFilters: { key: LeadSource | "all"; label: string }[] = [
  { key: "all", label: "All Sources" },
  { key: "phone", label: "Phone" },
  { key: "sms", label: "SMS" },
  { key: "meta", label: "Meta" },
  { key: "website", label: "Website" },
  { key: "google", label: "Google" },
  { key: "google_lsa", label: "Google LSA" },
  { key: "thumbtack", label: "Thumbtack" },
  { key: "manual", label: "Manual" },
  { key: "email", label: "Email" },
  { key: "vapi", label: "Vapi" },
  { key: "housecall_pro", label: "HCP" },
  { key: "angi", label: "Angi" },
  { key: "retargeting", label: "Retargeting" },
];

const sourceIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  phone: "call-outline",
  sms: "chatbubble-outline",
  meta: "logo-facebook",
  website: "globe-outline",
  google: "logo-google",
  google_lsa: "logo-google",
  thumbtack: "pin-outline",
  manual: "pencil-outline",
  email: "mail-outline",
  vapi: "call-outline",
  housecall_pro: "home-outline",
  ghl: "business-outline",
  seasonal_reminder: "sunny-outline",
  sam: "person-outline",
  angi: "construct-outline",
  retargeting: "refresh-outline",
};

const pipelineStageLabels: { key: string; label: string; color: string }[] = [
  { key: "new_lead", label: "New Lead", color: Theme.primary },
  { key: "engaged", label: "Engaged", color: "#6366f1" },
  { key: "quoted", label: "Quoted", color: "#f59e0b" },
  { key: "paid", label: "Paid", color: Theme.success },
  { key: "booked", label: "Booked", color: "#10b981" },
  { key: "completed", label: "Completed", color: "#22c55e" },
];

// ===== MAIN COMPONENT =====

export default function LeadsScreen() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [showFunnel, setShowFunnel] = useState(true);

  // ===== QUERIES =====

  const leadsQuery = useQuery({
    queryKey: ["leads", statusFilter],
    queryFn: () => fetchLeads(statusFilter === "all" ? undefined : statusFilter),
  });

  const pipelineQuery = useQuery({
    queryKey: ["pipeline"],
    queryFn: fetchPipeline,
  });

  const leads: Lead[] = (leadsQuery.data as any)?.data ?? [];
  const pipeline: Record<string, PipelineStage> =
    (pipelineQuery.data as any)?.stages ?? {};

  // ===== MUTATIONS =====

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: LeadStatus;
    }) => {
      return apiFetch(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to update status");
    },
  });

  const saveLeadMutation = useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string;
      fields: Partial<Lead>;
    }) => {
      return apiFetch(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      Alert.alert("Success", "Lead updated successfully");
      setSelectedLead(null);
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to save lead");
    },
  });

  // ===== FILTERING =====

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.includes(search) ||
          l.email?.toLowerCase().includes(q) ||
          l.service_interest?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, sourceFilter, search]);

  // ===== FUNNEL DATA =====

  const funnelData = useMemo(() => {
    const maxCount = Math.max(
      ...pipelineStageLabels.map(
        (s) => (pipeline[s.key] as PipelineStage)?.count ?? 0
      ),
      1
    );
    return pipelineStageLabels.map((stage) => {
      const data = pipeline[stage.key] as PipelineStage | undefined;
      const count = data?.count ?? 0;
      const value = data?.value ?? 0;
      return {
        ...stage,
        count,
        value,
        widthPercent: Math.max((count / maxCount) * 100, 4),
      };
    });
  }, [pipeline]);

  // ===== HANDLERS =====

  const onRefresh = useCallback(async () => {
    await Promise.all([leadsQuery.refetch(), pipelineQuery.refetch()]);
  }, []);

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setEditForm({
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? "",
      source: lead.source,
      status: lead.status,
      service_interest: lead.service_interest,
      estimated_value: lead.estimated_value,
      notes: lead.notes ?? "",
      conversation_context: lead.conversation_context ?? "",
    });
  };

  const handleStatusChipPress = (newStatus: LeadStatus) => {
    if (!selectedLead) return;
    setEditForm((prev) => ({ ...prev, status: newStatus }));
    updateStatusMutation.mutate({ id: selectedLead.id, status: newStatus });
    setSelectedLead({ ...selectedLead, status: newStatus });
  };

  const handleSaveLead = () => {
    if (!selectedLead) return;
    saveLeadMutation.mutate({ id: selectedLead.id, fields: editForm });
  };

  // ===== LOADING =====

  if (leadsQuery.isLoading && !leads.length) {
    return <LoadingScreen message="Loading leads..." />;
  }

  // ===== RENDER =====

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={leadsQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={Theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Pipeline Summary Stats */}
            <View style={styles.statsRow}>
              <StatCard
                title="New Leads"
                value={pipeline.new_lead?.count ?? 0}
                icon="person-add-outline"
                iconColor={Theme.primary}
              />
              <StatCard
                title="Pipeline Value"
                value={`$${Object.values(pipeline).reduce(
                  (sum: number, s: any) => sum + (s?.value ?? 0),
                  0
                )}`}
                icon="cash-outline"
                iconColor={Theme.success}
              />
            </View>

            {/* Funnel Visualization */}
            <TouchableOpacity
              onPress={() => setShowFunnel(!showFunnel)}
              style={styles.funnelToggle}
            >
              <Text style={styles.funnelToggleText}>Pipeline Funnel</Text>
              <Ionicons
                name={showFunnel ? "chevron-up" : "chevron-down"}
                size={16}
                color={Theme.mutedForeground}
              />
            </TouchableOpacity>
            {showFunnel && (
              <GlassCard style={styles.funnelCard}>
                {funnelData.map((stage) => (
                  <View key={stage.key} style={styles.funnelRow}>
                    <Text style={styles.funnelLabel} numberOfLines={1}>
                      {stage.label}
                    </Text>
                    <View style={styles.funnelBarContainer}>
                      <View
                        style={[
                          styles.funnelBar,
                          {
                            width: `${stage.widthPercent}%`,
                            backgroundColor: stage.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.funnelCount}>{stage.count}</Text>
                    <Text style={styles.funnelValue}>
                      ${stage.value.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Status Filter Tabs */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={statusTabs}
              keyExtractor={(item) => item.key}
              style={styles.filterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setStatusFilter(item.key)}
                  style={[
                    styles.filterChip,
                    statusFilter === item.key
                      ? styles.filterChipActive
                      : styles.filterChipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === item.key
                        ? styles.filterChipTextActive
                        : {},
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Source Filter Tabs */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={sourceFilters}
              keyExtractor={(item) => item.key}
              style={styles.filterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSourceFilter(item.key)}
                  style={[
                    styles.sourceChip,
                    sourceFilter === item.key
                      ? styles.sourceChipActive
                      : styles.sourceChipInactive,
                  ]}
                >
                  {item.key !== "all" && (
                    <Ionicons
                      name={sourceIcons[item.key] || "ellipse-outline"}
                      size={12}
                      color={
                        sourceFilter === item.key
                          ? "#ffffff"
                          : Theme.mutedForeground
                      }
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      sourceFilter === item.key
                        ? styles.filterChipTextActive
                        : {},
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search leads..."
            />
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openLeadDetail(item)}
          >
            <GlassCard style={styles.leadCard}>
              <View style={styles.rowStart}>
                <View style={styles.sourceAvatar}>
                  <Ionicons
                    name={sourceIcons[item.source] || "person-outline"}
                    size={18}
                    color={Theme.warning}
                  />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {item.name || item.phone}
                    </Text>
                    <Badge
                      label={item.status}
                      variant={
                        item.status === "booked"
                          ? "success"
                          : item.status === "lost"
                          ? "error"
                          : item.status === "new"
                          ? "info"
                          : "default"
                      }
                    />
                  </View>
                  <Text style={styles.subText}>
                    {item.phone} • {item.source}
                  </Text>
                  {item.service_interest ? (
                    <Text style={styles.subText}>
                      Interested in: {item.service_interest}
                    </Text>
                  ) : null}
                  {item.estimated_value != null ? (
                    <Text style={styles.valueText}>
                      ${item.estimated_value}
                    </Text>
                  ) : null}
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="trending-up-outline"
            title="No leads found"
            description="Leads will appear here as they come in"
          />
        }
      />

      {/* Lead Detail Modal */}
      <Modal
        visible={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || selectedLead?.phone || "Lead Details"}
      >
        {selectedLead && (
          <>
            {/* Status Picker Chips */}
            <Text style={styles.sectionLabel}>Status</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={statusChips}
              keyExtractor={(item) => item.key}
              style={{ marginBottom: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleStatusChipPress(item.key)}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        (editForm.status ?? selectedLead.status) === item.key
                          ? item.color
                          : Theme.muted,
                      borderColor:
                        (editForm.status ?? selectedLead.status) === item.key
                          ? item.color
                          : Theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color:
                          (editForm.status ?? selectedLead.status) === item.key
                            ? "#ffffff"
                            : Theme.mutedForeground,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Editable Fields */}
            <InputField
              label="Name"
              value={editForm.name ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, name: v }))
              }
              placeholder="Lead name"
            />
            <InputField
              label="Phone"
              value={editForm.phone ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, phone: v }))
              }
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
            <InputField
              label="Email"
              value={(editForm.email as string) ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, email: v }))
              }
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <InputField
              label="Source"
              value={editForm.source ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, source: v as LeadSource }))
              }
              placeholder="Lead source"
            />
            <InputField
              label="Service Interest"
              value={editForm.service_interest ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, service_interest: v }))
              }
              placeholder="Service interest"
            />
            <InputField
              label="Estimated Value ($)"
              value={
                editForm.estimated_value != null
                  ? String(editForm.estimated_value)
                  : ""
              }
              onChangeText={(v) =>
                setEditForm((p) => ({
                  ...p,
                  estimated_value: v ? parseFloat(v) || 0 : undefined,
                }))
              }
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <InputField
              label="Notes"
              value={(editForm.notes as string) ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, notes: v }))
              }
              placeholder="Notes about this lead"
              multiline
              numberOfLines={3}
            />
            <InputField
              label="Conversation Context"
              value={(editForm.conversation_context as string) ?? ""}
              onChangeText={(v) =>
                setEditForm((p) => ({ ...p, conversation_context: v }))
              }
              placeholder="Conversation context"
              multiline
              numberOfLines={3}
            />

            {/* Read-only date fields */}
            <View style={styles.dateFieldsRow}>
              <View style={styles.dateFieldBlock}>
                <Text style={styles.dateFieldLabel}>Created</Text>
                <Text style={styles.dateFieldValue}>
                  {new Date(selectedLead.created_at).toLocaleString()}
                </Text>
              </View>
              {selectedLead.contacted_at && (
                <View style={styles.dateFieldBlock}>
                  <Text style={styles.dateFieldLabel}>Contacted</Text>
                  <Text style={styles.dateFieldValue}>
                    {new Date(selectedLead.contacted_at).toLocaleString()}
                  </Text>
                </View>
              )}
              {selectedLead.booked_at && (
                <View style={styles.dateFieldBlock}>
                  <Text style={styles.dateFieldLabel}>Booked</Text>
                  <Text style={styles.dateFieldValue}>
                    {new Date(selectedLead.booked_at).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Save Button */}
            <View style={{ marginTop: 8 }}>
              <ActionButton
                title="Save Changes"
                onPress={handleSaveLead}
                loading={saveLeadMutation.isPending}
                disabled={saveLeadMutation.isPending}
              />
            </View>
          </>
        )}
      </Modal>
    </View>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Funnel
  funnelToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  funnelToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  funnelCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
  },
  funnelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  funnelLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  funnelBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: Theme.muted,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  funnelBar: {
    height: "100%",
    borderRadius: 4,
    minWidth: 4,
  },
  funnelCount: {
    width: 28,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "right",
  },
  funnelValue: {
    width: 58,
    fontSize: 11,
    color: Theme.success,
    fontWeight: "500",
    textAlign: "right",
  },

  // Filters
  filterList: {
    maxHeight: 48,
    paddingHorizontal: 8,
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
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 3,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  sourceChipActive: {
    backgroundColor: Theme.warning,
    borderColor: Theme.warning,
  },
  sourceChipInactive: {
    backgroundColor: "transparent",
    borderColor: Theme.border,
  },

  // Lead cards
  leadCard: {
    marginHorizontal: 16,
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
  sourceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.warningBg,
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
    marginRight: 8,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.success,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },

  // Modal detail
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 6,
  },
  statusChip: {
    marginRight: 6,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dateFieldsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  dateFieldBlock: {
    backgroundColor: Theme.muted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 100,
  },
  dateFieldLabel: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginBottom: 2,
  },
  dateFieldValue: {
    fontSize: 12,
    color: Theme.foreground,
    fontWeight: "500",
  },
});
