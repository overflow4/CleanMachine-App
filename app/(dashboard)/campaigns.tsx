import React, { useState } from "react";
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert,
  Modal as RNModal, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { Campaign } from "@/types";

/* ── Retargeting sequence types ── */
const SEQUENCE_TYPES = [
  "unresponsive",
  "quoted_not_booked",
  "one_time",
  "lapsed",
  "lost",
  "new_lead",
] as const;

type SequenceType = (typeof SEQUENCE_TYPES)[number];

interface SequenceStep {
  day: number;
  channel: string;
  template: string;
}

interface RetargetingSequence {
  type: SequenceType;
  name: string;
  steps: SequenceStep[];
  active_customers: number;
  enabled: boolean;
}

const SEQUENCE_LABELS: Record<SequenceType, string> = {
  unresponsive: "Unresponsive",
  quoted_not_booked: "Quoted Not Booked",
  one_time: "One-Time Customer",
  lapsed: "Lapsed Customer",
  lost: "Lost Customer",
  new_lead: "New Lead",
};

export default function CampaignsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => apiFetch("/api/campaigns"),
  });

  const sequencesQuery = useQuery({
    queryKey: ["retargeting-sequences"],
    queryFn: () => apiFetch("/api/campaigns/retargeting-sequences"),
  });

  const campaigns: Campaign[] = (data as any)?.data ?? (data as any)?.campaigns ?? [];
  const sequences: RetargetingSequence[] =
    (sequencesQuery.data as any)?.data ?? (sequencesQuery.data as any)?.sequences ?? [];

  const [expandedSequence, setExpandedSequence] = useState<SequenceType | null>(null);
  const [enrollModalSeq, setEnrollModalSeq] = useState<SequenceType | null>(null);
  const [enrollPhone, setEnrollPhone] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [togglingSeq, setTogglingSeq] = useState<SequenceType | null>(null);

  /* ── Create Campaign state ── */
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    type: "",
    message_template: "",
    start_date: "",
    end_date: "",
    segment: "",
  });
  const [creating, setCreating] = useState(false);

  /* ── Settings toggles state ── */
  const settingsQuery = useQuery({
    queryKey: ["campaign-settings"],
    queryFn: () => apiFetch("/api/actions/settings"),
  });
  const campaignSettings = (settingsQuery.data as any)?.settings ?? (settingsQuery.data as any)?.data ?? {};
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const getSequenceData = (type: SequenceType): RetargetingSequence => {
    const found = sequences.find((s) => s.type === type);
    return (
      found ?? {
        type,
        name: SEQUENCE_LABELS[type],
        steps: [],
        active_customers: 0,
        enabled: false,
      }
    );
  };

  const handleEnroll = async () => {
    if (!enrollPhone.trim() || !enrollModalSeq) return;
    setEnrolling(true);
    try {
      await apiFetch("/api/actions/retargeting-enroll", {
        method: "POST",
        body: JSON.stringify({ phone: enrollPhone.trim(), sequence: enrollModalSeq }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Enrolled", `Customer enrolled in ${SEQUENCE_LABELS[enrollModalSeq]} sequence`);
      setEnrollModalSeq(null);
      setEnrollPhone("");
      queryClient.invalidateQueries({ queryKey: ["retargeting-sequences"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const toggleSequence = async (type: SequenceType, enabled: boolean) => {
    setTogglingSeq(type);
    try {
      await apiFetch("/api/campaigns/retargeting-sequences", {
        method: "PATCH",
        body: JSON.stringify({ type, enabled }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["retargeting-sequences"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setTogglingSeq(null);
    }
  };

  /* ── Create campaign ── */
  const handleCreateCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.type.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(newCampaign),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Campaign created");
      setCreateModalVisible(false);
      setNewCampaign({ name: "", type: "", message_template: "", start_date: "", end_date: "", segment: "" });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
  };

  /* ── Delete campaign ── */
  const handleDeleteCampaign = (campaign: Campaign) => {
    Alert.alert(
      "Delete Campaign",
      `Are you sure you want to delete "${campaign.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  /* ── Toggle setting ── */
  const handleToggleSetting = async (key: string, value: boolean) => {
    setTogglingKey(key);
    try {
      await apiFetch("/api/actions/settings", {
        method: "POST",
        body: JSON.stringify({ [key]: value }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["campaign-settings"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setTogglingKey(null);
    }
  };

  const onRefresh = async () => {
    await Promise.all([refetch(), sequencesQuery.refetch(), settingsQuery.refetch()]);
  };

  if (isLoading) return <LoadingScreen message="Loading campaigns..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || sequencesQuery.isRefetching}
          onRefresh={onRefresh}
          tintColor={Theme.primary}
        />
      }
    >
      {/* ── Settings Toggles ── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Campaign Settings</Text>
        <GlassCard style={{ marginBottom: 10 }}>
          <View style={styles.settingToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Seasonal Reminders</Text>
              <Text style={styles.settingDesc}>Automatically send seasonal cleaning reminders</Text>
            </View>
            {togglingKey === "seasonal_reminders_enabled" ? (
              <ActivityIndicator size="small" color={Theme.primary} />
            ) : (
              <Switch
                value={campaignSettings.seasonal_reminders_enabled ?? false}
                onValueChange={(v) => handleToggleSetting("seasonal_reminders_enabled", v)}
                trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
                thumbColor={campaignSettings.seasonal_reminders_enabled ? Theme.primary : Theme.mutedForeground}
              />
            )}
          </View>
          <View style={[styles.settingToggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Frequency Nudge</Text>
              <Text style={styles.settingDesc}>Nudge customers who haven't booked in a while</Text>
            </View>
            {togglingKey === "frequency_nudge_enabled" ? (
              <ActivityIndicator size="small" color={Theme.primary} />
            ) : (
              <Switch
                value={campaignSettings.frequency_nudge_enabled ?? false}
                onValueChange={(v) => handleToggleSetting("frequency_nudge_enabled", v)}
                trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
                thumbColor={campaignSettings.frequency_nudge_enabled ? Theme.primary : Theme.mutedForeground}
              />
            )}
          </View>
        </GlassCard>
      </View>

      {/* ── Create Campaign Button ── */}
      <View style={styles.section}>
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={styles.createBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create Campaign</Text>
        </TouchableOpacity>
      </View>

      {/* ── Retargeting Sequences ── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Retargeting Sequences</Text>
        {SEQUENCE_TYPES.map((type) => {
          const seq = getSequenceData(type);
          const isExpanded = expandedSequence === type;
          return (
            <GlassCard key={type} style={styles.seqCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedSequence(isExpanded ? null : type)}
                style={styles.seqHeader}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.seqName}>{SEQUENCE_LABELS[type]}</Text>
                  <Text style={styles.seqMeta}>
                    {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""} · {seq.active_customers} active
                  </Text>
                </View>
                <View style={styles.seqActions}>
                  {togglingSeq === type ? (
                    <ActivityIndicator size="small" color={Theme.primary} />
                  ) : (
                    <Switch
                      value={seq.enabled}
                      onValueChange={(v) => toggleSequence(type, v)}
                      trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
                      thumbColor={seq.enabled ? Theme.primary : Theme.mutedForeground}
                    />
                  )}
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={Theme.mutedForeground}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.seqBody}>
                  {seq.steps.length === 0 ? (
                    <Text style={styles.emptyStepText}>No steps configured</Text>
                  ) : (
                    seq.steps.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepBadge}>
                          <Text style={styles.stepBadgeText}>Day {step.day}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.stepChannel}>{step.channel}</Text>
                          <Text style={styles.stepTemplate} numberOfLines={2}>
                            {step.template}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setEnrollModalSeq(type);
                      setEnrollPhone("");
                    }}
                    style={styles.enrollBtn}
                  >
                    <Ionicons name="person-add-outline" size={16} color={Theme.primary} />
                    <Text style={styles.enrollBtnText}>Enroll Customer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>
          );
        })}
      </View>

      {/* ── Campaigns List ── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Campaigns</Text>
        {campaigns.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No campaigns"
            description="Marketing campaigns will appear here"
          />
        ) : (
          campaigns.map((campaign, i) => (
            <GlassCard key={campaign.id || i} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{campaign.name}</Text>
                  <Text style={styles.subText}>{campaign.type}</Text>
                </View>
                <Badge
                  label={campaign.status}
                  variant={
                    campaign.status === "active"
                      ? "success"
                      : campaign.status === "completed"
                      ? "info"
                      : campaign.status === "paused"
                      ? "warning"
                      : "default"
                  }
                />
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{campaign.target_count}</Text>
                  <Text style={styles.metricLabel}>Target</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Theme.primary }]}>
                    {campaign.sent_count}
                  </Text>
                  <Text style={styles.metricLabel}>Sent</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Theme.success }]}>
                    {campaign.response_count}
                  </Text>
                  <Text style={styles.metricLabel}>Responses</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {new Date(campaign.created_at).toLocaleDateString()}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCampaign(campaign)}
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={Theme.destructive} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        )}
      </View>

      {/* ── Enroll Modal ── */}
      <RNModal
        visible={enrollModalSeq !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEnrollModalSeq(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Enroll in {enrollModalSeq ? SEQUENCE_LABELS[enrollModalSeq] : ""}
            </Text>
            <Text style={styles.modalDesc}>
              Enter the customer phone number to enroll in this retargeting sequence.
            </Text>
            <TextInput
              value={enrollPhone}
              onChangeText={setEnrollPhone}
              placeholder="Phone number"
              placeholderTextColor={Theme.mutedForeground}
              style={styles.modalInput}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setEnrollModalSeq(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEnroll}
                disabled={enrolling || !enrollPhone.trim()}
                style={[
                  styles.modalConfirmBtn,
                  (!enrollPhone.trim() || enrolling) && { opacity: 0.5 },
                ]}
              >
                {enrolling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Enroll</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── Create Campaign Modal ── */}
      <RNModal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create Campaign</Text>
              <Text style={styles.modalDesc}>Set up a new marketing campaign.</Text>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Campaign Name</Text>
                <TextInput
                  value={newCampaign.name}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, name: v }))}
                  placeholder="e.g. Spring Deep Clean"
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Type</Text>
                <TextInput
                  value={newCampaign.type}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, type: v }))}
                  placeholder="e.g. seasonal, promotional, retargeting"
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Message Template</Text>
                <TextInput
                  value={newCampaign.message_template}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, message_template: v }))}
                  placeholder="Hi {name}, ..."
                  placeholderTextColor={Theme.mutedForeground}
                  style={[styles.modalInput, { minHeight: 80, textAlignVertical: "top" }]}
                  multiline
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={newCampaign.start_date}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, start_date: v }))}
                  placeholder="2026-04-15"
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={newCampaign.end_date}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, end_date: v }))}
                  placeholder="2026-05-15"
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Segment Targeting</Text>
                <TextInput
                  value={newCampaign.segment}
                  onChangeText={(v) => setNewCampaign((p) => ({ ...p, segment: v }))}
                  placeholder="e.g. lapsed, one_time, all"
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setCreateModalVisible(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateCampaign}
                  disabled={creating || !newCampaign.name.trim() || !newCampaign.type.trim()}
                  style={[
                    styles.modalConfirmBtn,
                    (creating || !newCampaign.name.trim() || !newCampaign.type.trim()) && { opacity: 0.5 },
                  ]}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </RNModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  /* ── Sequence styles ── */
  seqCard: {
    marginBottom: 10,
  },
  seqHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  seqName: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  seqMeta: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  seqActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seqBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  emptyStepText: {
    fontSize: 13,
    color: Theme.mutedForeground,
    fontStyle: "italic",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  stepBadge: {
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 52,
    alignItems: "center",
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.primaryLight,
  },
  stepChannel: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
  },
  stepTemplate: {
    fontSize: 13,
    color: Theme.foreground,
    marginTop: 2,
  },
  enrollBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.primary,
  },
  enrollBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.primary,
  },
  /* ── Campaign card styles ── */
  card: {
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  subText: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  metricsRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricItem: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.foreground,
  },
  metricLabel: {
    fontSize: 11,
    color: Theme.mutedForeground,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dateText: {
    fontSize: 11,
    color: Theme.zinc400,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(212,9,36,0.1)",
  },
  /* ── Settings toggle styles ── */
  settingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
  },
  settingDesc: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  /* ── Create button ── */
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: Theme.primary,
    paddingVertical: 12,
  },
  createBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  /* ── Modal field styles ── */
  modalFieldGroup: {
    marginBottom: 12,
  },
  modalFieldLabel: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  /* ── Modal styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginBottom: 16,
  },
  modalInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.foreground,
    fontSize: 15,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: Theme.primary,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
