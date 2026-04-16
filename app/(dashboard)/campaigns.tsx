import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { FunnelChart } from "@/components/ui/charts/FunnelChart";
import { Theme } from "@/constants/colors";
import { Campaign } from "@/types";

/* ── Tab definitions ── */
const TABS = ["Campaigns", "Sequences", "Journey", "A/B Results"] as const;
type Tab = (typeof TABS)[number];

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
  template_a?: string;
  template_b?: string;
  delay_hours?: number;
}

interface RetargetingSequence {
  type: SequenceType;
  name: string;
  steps: SequenceStep[];
  active_customers: number;
  enabled: boolean;
}

interface AbResult {
  sequence_type: string;
  variant_a: { name: string; enrolled: number; replied: number; converted: number };
  variant_b: { name: string; enrolled: number; replied: number; converted: number };
}

interface LeadJourneyData {
  followup_count: number;
  retargeting_count: number;
  conversion_count: number;
}

const SEQUENCE_LABELS: Record<SequenceType, string> = {
  unresponsive: "Unresponsive",
  quoted_not_booked: "Quoted Not Booked",
  one_time: "One-Time Customer",
  lapsed: "Lapsed Customer",
  lost: "Lost Customer",
  new_lead: "New Lead",
};

const EMPTY_CAMPAIGN = {
  name: "",
  type: "",
  message_template: "",
  start_date: "",
  end_date: "",
  segment: "",
};

export default function CampaignsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Campaigns");

  /* ── Queries ── */
  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => apiFetch("/api/campaigns"),
  });

  const sequencesQuery = useQuery({
    queryKey: ["retargeting-sequences"],
    queryFn: () => apiFetch("/api/campaigns/retargeting-sequences"),
  });

  const settingsQuery = useQuery({
    queryKey: ["campaign-settings"],
    queryFn: () => apiFetch("/api/actions/settings"),
  });

  const journeyQuery = useQuery({
    queryKey: ["lead-journey"],
    queryFn: () => apiFetch("/api/actions/lead-journey"),
    enabled: activeTab === "Journey",
  });

  const abResultsQuery = useQuery({
    queryKey: ["retargeting-ab-results"],
    queryFn: () => apiFetch("/api/actions/retargeting-ab-results"),
    enabled: activeTab === "A/B Results",
  });

  const campaigns: Campaign[] =
    (campaignsQuery.data as any)?.data ?? (campaignsQuery.data as any)?.campaigns ?? [];
  const sequences: RetargetingSequence[] =
    (sequencesQuery.data as any)?.data ?? (sequencesQuery.data as any)?.sequences ?? [];
  const campaignSettings =
    (settingsQuery.data as any)?.settings ?? (settingsQuery.data as any)?.data ?? {};
  const journeyData: LeadJourneyData | null =
    (journeyQuery.data as any)?.data ?? (journeyQuery.data as any)?.journey ?? null;
  const abResults: AbResult[] =
    (abResultsQuery.data as any)?.data ?? (abResultsQuery.data as any)?.results ?? [];

  /* ── Local state ── */
  const [expandedSequence, setExpandedSequence] = useState<SequenceType | null>(null);
  const [enrollModalSeq, setEnrollModalSeq] = useState<SequenceType | null>(null);
  const [enrollPhone, setEnrollPhone] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [togglingSeq, setTogglingSeq] = useState<SequenceType | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  /* ── Create/Edit campaign state ── */
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [saving, setSaving] = useState(false);

  /* ── CSV import state ── */
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  /* ── Helpers ── */
  const getSequenceData = (type: SequenceType): RetargetingSequence => {
    const found = sequences.find((s) => s.type === type);
    return found ?? {
      type, name: SEQUENCE_LABELS[type], steps: [], active_customers: 0, enabled: false,
    };
  };

  const conversionRate = (sent: number, responses: number) => {
    if (!sent) return "0%";
    return ((responses / sent) * 100).toFixed(1) + "%";
  };

  /* ── Actions ── */
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

  const openCreateModal = () => {
    setEditingCampaign(null);
    setCampaignForm(EMPTY_CAMPAIGN);
    setCreateModalVisible(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name ?? "",
      type: campaign.type ?? "",
      message_template: (campaign as any).message_template ?? "",
      start_date: (campaign as any).start_date ?? "",
      end_date: (campaign as any).end_date ?? "",
      segment: (campaign as any).segment ?? "",
    });
    setCreateModalVisible(true);
  };

  const handleSaveCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.type.trim()) return;
    setSaving(true);
    try {
      if (editingCampaign) {
        await apiFetch(`/api/campaigns/${editingCampaign.id}`, {
          method: "PATCH",
          body: JSON.stringify(campaignForm),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Campaign updated");
      } else {
        await apiFetch("/api/campaigns", {
          method: "POST",
          body: JSON.stringify(campaignForm),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Campaign created");
      }
      setCreateModalVisible(false);
      setEditingCampaign(null);
      setCampaignForm(EMPTY_CAMPAIGN);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

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

  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const leads = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      }).filter((l) => l.name || l.phone);

      if (!leads.length) {
        Alert.alert("Error", "No valid rows found. CSV must have a header row with name and/or phone columns.");
        return;
      }

      await apiFetch("/api/actions/batch-create-leads", {
        method: "POST",
        body: JSON.stringify({ leads }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Imported", `${leads.length} lead(s) imported successfully`);
      setCsvModalVisible(false);
      setCsvText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setImporting(false);
    }
  };

  const onRefresh = async () => {
    await Promise.all([
      campaignsQuery.refetch(),
      sequencesQuery.refetch(),
      settingsQuery.refetch(),
      ...(activeTab === "Journey" ? [journeyQuery.refetch()] : []),
      ...(activeTab === "A/B Results" ? [abResultsQuery.refetch()] : []),
    ]);
  };

  const isLoading = campaignsQuery.isLoading;
  const isRefetching = campaignsQuery.isRefetching || sequencesQuery.isRefetching;

  if (isLoading) return <LoadingScreen message="Loading campaigns..." />;

  /* ── Render helpers ── */

  const renderCampaignsTab = () => (
    <>
      {/* Settings */}
      <View style={s.section}>
        <Text style={s.sectionHeader}>Automation Settings</Text>
        <GlassCard>
          {/* Seasonal Reminders */}
          <View style={s.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Seasonal Reminders</Text>
              <Text style={s.settingDesc}>Automatically send seasonal cleaning reminders</Text>
              {campaignSettings.seasonal_campaign_types && (
                <View style={s.settingTagRow}>
                  {(Array.isArray(campaignSettings.seasonal_campaign_types)
                    ? campaignSettings.seasonal_campaign_types
                    : []
                  ).map((t: string, i: number) => (
                    <View key={i} style={s.settingTag}>
                      <Text style={s.settingTagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
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

          {/* Frequency Nudge */}
          <View style={[s.settingRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Frequency Nudge</Text>
              <Text style={s.settingDesc}>Nudge customers who haven't booked in a while</Text>
              {campaignSettings.frequency_nudge_days != null && (
                <View style={s.nudgeDaysBadge}>
                  <Ionicons name="time-outline" size={12} color={Theme.primaryLight} />
                  <Text style={s.nudgeDaysText}>
                    {campaignSettings.frequency_nudge_days} day threshold
                  </Text>
                </View>
              )}
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

      {/* Action Buttons */}
      <View style={s.section}>
        <View style={s.actionRow}>
          <TouchableOpacity onPress={openCreateModal} style={s.createBtn} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.createBtnText}>New Campaign</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCsvModalVisible(true)}
            style={s.csvBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={Theme.primary} />
            <Text style={s.csvBtnText}>CSV Import</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Campaigns List */}
      <View style={s.section}>
        <Text style={s.sectionHeader}>Campaigns</Text>
        {campaigns.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No campaigns"
            description="Marketing campaigns will appear here"
          />
        ) : (
          campaigns.map((campaign, i) => (
            <GlassCard key={campaign.id || i} style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{campaign.name}</Text>
                  <Text style={s.subText}>{campaign.type}</Text>
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

              {/* Analytics metrics */}
              <View style={s.analyticsRow}>
                <View style={s.analyticItem}>
                  <Ionicons name="people-outline" size={14} color={Theme.mutedForeground} />
                  <Text style={s.analyticValue}>{campaign.target_count ?? 0}</Text>
                  <Text style={s.analyticLabel}>Target</Text>
                </View>
                <View style={s.analyticItem}>
                  <Ionicons name="send-outline" size={14} color={Theme.primary} />
                  <Text style={[s.analyticValue, { color: Theme.primary }]}>
                    {campaign.sent_count ?? 0}
                  </Text>
                  <Text style={s.analyticLabel}>Sent</Text>
                </View>
                <View style={s.analyticItem}>
                  <Ionicons name="chatbubbles-outline" size={14} color={Theme.success} />
                  <Text style={[s.analyticValue, { color: Theme.success }]}>
                    {campaign.response_count ?? 0}
                  </Text>
                  <Text style={s.analyticLabel}>Responses</Text>
                </View>
                <View style={s.analyticItem}>
                  <Ionicons name="trending-up-outline" size={14} color={Theme.warning} />
                  <Text style={[s.analyticValue, { color: Theme.warning }]}>
                    {conversionRate(campaign.sent_count, campaign.response_count)}
                  </Text>
                  <Text style={s.analyticLabel}>Conv.</Text>
                </View>
              </View>

              <View style={s.cardFooter}>
                <Text style={s.dateText}>
                  {new Date(campaign.created_at).toLocaleDateString()}
                </Text>
                <View style={s.cardActions}>
                  <TouchableOpacity
                    onPress={() => openEditModal(campaign)}
                    style={s.editBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={16} color={Theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCampaign(campaign)}
                    style={s.deleteBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={Theme.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </View>
    </>
  );

  const renderSequencesTab = () => (
    <View style={s.section}>
      <Text style={s.sectionHeader}>Retargeting Sequences</Text>
      {SEQUENCE_TYPES.map((type) => {
        const seq = getSequenceData(type);
        const isExpanded = expandedSequence === type;
        return (
          <GlassCard key={type} style={s.card}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedSequence(isExpanded ? null : type)}
              style={s.seqHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.seqName}>{SEQUENCE_LABELS[type]}</Text>
                <Text style={s.seqMeta}>
                  {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""} ·{" "}
                  {seq.active_customers} active
                </Text>
              </View>
              <View style={s.seqActions}>
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
              <View style={s.seqBody}>
                {seq.steps.length === 0 ? (
                  <Text style={s.emptyStepText}>No steps configured</Text>
                ) : (
                  seq.steps.map((step, i) => (
                    <View key={i} style={s.stepCard}>
                      {/* Step header */}
                      <View style={s.stepHeaderRow}>
                        <View style={s.stepBadge}>
                          <Text style={s.stepBadgeText}>Step {i + 1}</Text>
                        </View>
                        <View style={s.stepTimingBadge}>
                          <Ionicons name="time-outline" size={11} color={Theme.zinc400} />
                          <Text style={s.stepTimingText}>
                            Day {step.day}
                            {step.delay_hours != null ? ` (+${step.delay_hours}h)` : ""}
                          </Text>
                        </View>
                      </View>

                      {/* Channel and template */}
                      <View style={s.stepDetailRow}>
                        <Ionicons
                          name={step.channel === "sms" ? "chatbubble-outline" : "mail-outline"}
                          size={13}
                          color={Theme.mutedForeground}
                        />
                        <Text style={s.stepChannelLabel}>
                          {step.channel?.toUpperCase() ?? "SMS"}
                        </Text>
                      </View>
                      <Text style={s.stepTemplate} numberOfLines={3}>
                        {step.template}
                      </Text>

                      {/* A/B variants */}
                      {(step.template_a || step.template_b) && (
                        <View style={s.abVariantsContainer}>
                          {step.template_a && (
                            <View style={s.abVariantRow}>
                              <View style={[s.abBadge, { backgroundColor: "rgba(0,145,255,0.15)" }]}>
                                <Text style={[s.abBadgeText, { color: Theme.primary }]}>A</Text>
                              </View>
                              <Text style={s.abTemplateText} numberOfLines={2}>
                                {step.template_a}
                              </Text>
                            </View>
                          )}
                          {step.template_b && (
                            <View style={s.abVariantRow}>
                              <View style={[s.abBadge, { backgroundColor: "rgba(196,181,253,0.15)" }]}>
                                <Text style={[s.abBadgeText, { color: Theme.violet300 }]}>B</Text>
                              </View>
                              <Text style={s.abTemplateText} numberOfLines={2}>
                                {step.template_b}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))
                )}
                <TouchableOpacity
                  onPress={() => {
                    setEnrollModalSeq(type);
                    setEnrollPhone("");
                  }}
                  style={s.enrollBtn}
                >
                  <Ionicons name="person-add-outline" size={16} color={Theme.primary} />
                  <Text style={s.enrollBtnText}>Enroll Customer</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        );
      })}
    </View>
  );

  const renderJourneyTab = () => {
    const loading = journeyQuery.isLoading;
    const fStages = journeyData
      ? [
          { label: "Follow-up", value: journeyData.followup_count, color: Theme.primary },
          { label: "Retargeting", value: journeyData.retargeting_count, color: Theme.violet400 },
          { label: "Converted", value: journeyData.conversion_count, color: Theme.success },
        ]
      : [];

    return (
      <View style={s.section}>
        <Text style={s.sectionHeader}>Lead Journey</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Theme.primary} style={{ marginTop: 40 }} />
        ) : !journeyData ? (
          <EmptyState
            icon="analytics-outline"
            title="No journey data"
            description="Lead journey stats will appear once sequences are active"
          />
        ) : (
          <>
            {/* Summary metrics */}
            <View style={s.metricsGrid}>
              <MetricCard
                title="Follow-ups"
                value={journeyData.followup_count}
                icon="arrow-redo-outline"
                iconColor={Theme.primary}
                compact
              />
              <MetricCard
                title="Retargeting"
                value={journeyData.retargeting_count}
                icon="refresh-outline"
                iconColor={Theme.violet400}
                compact
              />
              <MetricCard
                title="Conversions"
                value={journeyData.conversion_count}
                icon="checkmark-circle-outline"
                iconColor={Theme.success}
                compact
              />
            </View>

            {/* Flow visualization */}
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={s.flowTitle}>Conversion Funnel</Text>
              <FunnelChart stages={fStages} showDropoff />
            </GlassCard>

            {/* Simple flow arrows */}
            <GlassCard style={{ marginTop: 12 }}>
              <Text style={s.flowTitle}>Journey Flow</Text>
              <View style={s.flowContainer}>
                <View style={s.flowNode}>
                  <View style={[s.flowCircle, { backgroundColor: Theme.primaryMuted }]}>
                    <Ionicons name="arrow-redo-outline" size={18} color={Theme.primary} />
                  </View>
                  <Text style={s.flowNodeLabel}>Follow-up</Text>
                  <Text style={s.flowNodeValue}>{journeyData.followup_count}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Theme.zinc600} />
                <View style={s.flowNode}>
                  <View style={[s.flowCircle, { backgroundColor: "rgba(167,139,250,0.15)" }]}>
                    <Ionicons name="refresh-outline" size={18} color={Theme.violet400} />
                  </View>
                  <Text style={s.flowNodeLabel}>Retargeting</Text>
                  <Text style={s.flowNodeValue}>{journeyData.retargeting_count}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Theme.zinc600} />
                <View style={s.flowNode}>
                  <View style={[s.flowCircle, { backgroundColor: Theme.successBg }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Theme.success} />
                  </View>
                  <Text style={s.flowNodeLabel}>Converted</Text>
                  <Text style={s.flowNodeValue}>{journeyData.conversion_count}</Text>
                </View>
              </View>
            </GlassCard>
          </>
        )}
      </View>
    );
  };

  const renderAbResultsTab = () => {
    const loading = abResultsQuery.isLoading;
    return (
      <View style={s.section}>
        <Text style={s.sectionHeader}>A/B Test Results</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Theme.primary} style={{ marginTop: 40 }} />
        ) : abResults.length === 0 ? (
          <EmptyState
            icon="flask-outline"
            title="No A/B results"
            description="A/B test results will appear once variants are running"
          />
        ) : (
          abResults.map((result, idx) => {
            const label = SEQUENCE_LABELS[result.sequence_type as SequenceType] ?? result.sequence_type;
            const a = result.variant_a;
            const b = result.variant_b;
            const aConvRate = a.enrolled > 0 ? ((a.converted / a.enrolled) * 100).toFixed(1) : "0.0";
            const bConvRate = b.enrolled > 0 ? ((b.converted / b.enrolled) * 100).toFixed(1) : "0.0";
            const aWins = parseFloat(aConvRate) >= parseFloat(bConvRate);

            return (
              <GlassCard key={idx} style={s.card}>
                <Text style={s.abSequenceTitle}>{label}</Text>

                {/* Variant A */}
                <View style={s.abVariantCard}>
                  <View style={s.abVariantHeader}>
                    <View style={[s.abBadge, { backgroundColor: "rgba(0,145,255,0.15)" }]}>
                      <Text style={[s.abBadgeText, { color: Theme.primary }]}>A</Text>
                    </View>
                    <Text style={s.abVariantName} numberOfLines={1}>
                      {a.name || "Variant A"}
                    </Text>
                    {aWins && (
                      <View style={s.winnerBadge}>
                        <Ionicons name="trophy" size={10} color={Theme.warning} />
                        <Text style={s.winnerText}>Leading</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.abStatsRow}>
                    <View style={s.abStat}>
                      <Text style={s.abStatValue}>{a.enrolled}</Text>
                      <Text style={s.abStatLabel}>Enrolled</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={s.abStatValue}>{a.replied}</Text>
                      <Text style={s.abStatLabel}>Replied</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={[s.abStatValue, { color: Theme.success }]}>{a.converted}</Text>
                      <Text style={s.abStatLabel}>Converted</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={[s.abStatValue, { color: Theme.warning }]}>{aConvRate}%</Text>
                      <Text style={s.abStatLabel}>Conv. Rate</Text>
                    </View>
                  </View>
                </View>

                {/* Variant B */}
                <View style={s.abVariantCard}>
                  <View style={s.abVariantHeader}>
                    <View style={[s.abBadge, { backgroundColor: "rgba(196,181,253,0.15)" }]}>
                      <Text style={[s.abBadgeText, { color: Theme.violet300 }]}>B</Text>
                    </View>
                    <Text style={s.abVariantName} numberOfLines={1}>
                      {b.name || "Variant B"}
                    </Text>
                    {!aWins && (
                      <View style={s.winnerBadge}>
                        <Ionicons name="trophy" size={10} color={Theme.warning} />
                        <Text style={s.winnerText}>Leading</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.abStatsRow}>
                    <View style={s.abStat}>
                      <Text style={s.abStatValue}>{b.enrolled}</Text>
                      <Text style={s.abStatLabel}>Enrolled</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={s.abStatValue}>{b.replied}</Text>
                      <Text style={s.abStatLabel}>Replied</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={[s.abStatValue, { color: Theme.success }]}>{b.converted}</Text>
                      <Text style={s.abStatLabel}>Converted</Text>
                    </View>
                    <View style={s.abStat}>
                      <Text style={[s.abStatValue, { color: Theme.warning }]}>{bConvRate}%</Text>
                      <Text style={s.abStatLabel}>Conv. Rate</Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            );
          })
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[s.tab, active && s.tabActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={Theme.primary}
          />
        }
      >
        {activeTab === "Campaigns" && renderCampaignsTab()}
        {activeTab === "Sequences" && renderSequencesTab()}
        {activeTab === "Journey" && renderJourneyTab()}
        {activeTab === "A/B Results" && renderAbResultsTab()}
      </ScrollView>

      {/* ── Enroll Modal ── */}
      <Modal
        visible={enrollModalSeq !== null}
        onClose={() => setEnrollModalSeq(null)}
        title={`Enroll in ${enrollModalSeq ? SEQUENCE_LABELS[enrollModalSeq] : ""}`}
      >
        <Text style={s.modalDesc}>
          Enter the customer phone number to enroll in this retargeting sequence.
        </Text>
        <InputField
          label="Phone Number"
          value={enrollPhone}
          onChangeText={setEnrollPhone}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          autoFocus
        />
        <View style={s.modalBtnRow}>
          <ActionButton
            title="Cancel"
            variant="outline"
            onPress={() => setEnrollModalSeq(null)}
          />
          <ActionButton
            title="Enroll"
            onPress={handleEnroll}
            loading={enrolling}
            disabled={!enrollPhone.trim()}
          />
        </View>
      </Modal>

      {/* ── Create/Edit Campaign Modal ── */}
      <Modal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingCampaign(null);
        }}
        title={editingCampaign ? "Edit Campaign" : "Create Campaign"}
      >
        <InputField
          label="Campaign Name"
          value={campaignForm.name}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, name: v }))}
          placeholder="e.g. Spring Deep Clean"
        />
        <InputField
          label="Type"
          value={campaignForm.type}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, type: v }))}
          placeholder="e.g. seasonal, promotional, retargeting"
        />
        <InputField
          label="Message Template"
          value={campaignForm.message_template}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, message_template: v }))}
          placeholder="Hi {name}, ..."
          multiline
          style={{ minHeight: 80 }}
        />
        <InputField
          label="Start Date (YYYY-MM-DD)"
          value={campaignForm.start_date}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, start_date: v }))}
          placeholder="2026-04-15"
        />
        <InputField
          label="End Date (YYYY-MM-DD)"
          value={campaignForm.end_date}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, end_date: v }))}
          placeholder="2026-05-15"
        />
        <InputField
          label="Segment Targeting"
          value={campaignForm.segment}
          onChangeText={(v) => setCampaignForm((p) => ({ ...p, segment: v }))}
          placeholder="e.g. lapsed, one_time, all"
        />
        <View style={s.modalBtnRow}>
          <ActionButton
            title="Cancel"
            variant="outline"
            onPress={() => {
              setCreateModalVisible(false);
              setEditingCampaign(null);
            }}
          />
          <ActionButton
            title={editingCampaign ? "Save Changes" : "Create"}
            onPress={handleSaveCampaign}
            loading={saving}
            disabled={!campaignForm.name.trim() || !campaignForm.type.trim()}
          />
        </View>
      </Modal>

      {/* ── CSV Import Modal ── */}
      <Modal
        visible={csvModalVisible}
        onClose={() => setCsvModalVisible(false)}
        title="CSV Import"
      >
        <Text style={s.modalDesc}>
          Paste CSV data below. First row should be headers (name, phone, email, address, etc).
        </Text>
        <TextInput
          value={csvText}
          onChangeText={setCsvText}
          placeholder={"name,phone,email\nJohn Doe,5551234567,john@example.com"}
          placeholderTextColor={Theme.mutedForeground}
          style={s.csvInput}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        {csvText.trim().length > 0 && (
          <Text style={s.csvPreview}>
            {csvText.trim().split("\n").length - 1} row(s) detected
          </Text>
        )}
        <View style={s.modalBtnRow}>
          <ActionButton
            title="Cancel"
            variant="outline"
            onPress={() => setCsvModalVisible(false)}
          />
          <ActionButton
            title="Import Leads"
            onPress={handleCsvImport}
            loading={importing}
            disabled={!csvText.trim()}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },

  /* ── Tab bar ── */
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Theme.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.foreground,
    fontWeight: "600",
  },

  /* ── Sections ── */
  section: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },

  /* ── Settings ── */
  settingRow: {
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
  settingTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  settingTag: {
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  settingTagText: {
    fontSize: 11,
    color: Theme.primaryLight,
    fontWeight: "500",
  },
  nudgeDaysBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  nudgeDaysText: {
    fontSize: 11,
    color: Theme.primaryLight,
    fontWeight: "500",
  },

  /* ── Action buttons ── */
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  createBtn: {
    flex: 1,
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
  csvBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "transparent",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Theme.primary,
  },
  csvBtnText: {
    color: Theme.primary,
    fontWeight: "600",
    fontSize: 15,
  },

  /* ── Campaign card ── */
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

  /* ── Campaign analytics ── */
  analyticsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  analyticItem: {
    alignItems: "center",
    gap: 2,
  },
  analyticValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.foreground,
  },
  analyticLabel: {
    fontSize: 10,
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
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(0,145,255,0.1)",
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(212,9,36,0.1)",
  },

  /* ── Sequence styles ── */
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

  /* ── Step card ── */
  stepCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  stepBadge: {
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.primaryLight,
  },
  stepTimingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepTimingText: {
    fontSize: 11,
    color: Theme.zinc400,
    fontWeight: "500",
  },
  stepDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  stepChannelLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  stepTemplate: {
    fontSize: 13,
    color: Theme.foreground,
    lineHeight: 18,
  },

  /* ── A/B variant display in steps ── */
  abVariantsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    gap: 6,
  },
  abVariantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  abBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  abBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  abTemplateText: {
    flex: 1,
    fontSize: 12,
    color: Theme.mutedForeground,
    lineHeight: 17,
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

  /* ── Metrics grid ── */
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
  },

  /* ── Journey flow ── */
  flowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  flowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flowNode: {
    alignItems: "center",
    flex: 1,
  },
  flowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  flowNodeLabel: {
    fontSize: 11,
    color: Theme.mutedForeground,
    fontWeight: "500",
  },
  flowNodeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.foreground,
    marginTop: 2,
  },

  /* ── A/B Results tab ── */
  abSequenceTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 4,
  },
  abVariantCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  abVariantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  abVariantName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  winnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  winnerText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.warning,
  },
  abStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  abStat: {
    alignItems: "center",
  },
  abStatValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.foreground,
  },
  abStatLabel: {
    fontSize: 10,
    color: Theme.mutedForeground,
    marginTop: 2,
  },

  /* ── Modal helpers ── */
  modalDesc: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  /* ── CSV ── */
  csvInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.foreground,
    fontSize: 13,
    fontFamily: "monospace",
    minHeight: 120,
  },
  csvPreview: {
    fontSize: 12,
    color: Theme.primaryLight,
    fontWeight: "500",
  },
});
