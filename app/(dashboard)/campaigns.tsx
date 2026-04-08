import React, { useState } from "react";
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert,
  Modal as RNModal,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const onRefresh = async () => {
    await Promise.all([refetch(), sequencesQuery.refetch()]);
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
              <Text style={styles.dateText}>
                {new Date(campaign.created_at).toLocaleDateString()}
              </Text>
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
  dateText: {
    marginTop: 8,
    fontSize: 11,
    color: Theme.zinc400,
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
