import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchLeads, fetchPipeline, apiFetch } from "@/lib/api";
import { Lead, LeadStatus, LeadSource, PipelineStage } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { BarChart, BarChartItem } from "@/components/ui/charts/BarChart";
import { Theme } from "@/constants/colors";

// ===== CONSTANTS =====

type TimePeriod = "today" | "week" | "month" | "quarter";

const timePeriods: { key: TimePeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
];

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

const sourceColors: Record<string, string> = {
  phone: Theme.primary,
  sms: "#6366f1",
  meta: "#3b82f6",
  website: Theme.success,
  google: "#f59e0b",
  google_lsa: "#eab308",
  thumbtack: "#ec4899",
  manual: Theme.zinc400,
  email: "#8b5cf6",
  vapi: Theme.cyan400,
  housecall_pro: Theme.teal400,
  ghl: Theme.violet400,
  seasonal_reminder: Theme.amber400,
  sam: Theme.emerald400,
  angi: Theme.red400,
  retargeting: Theme.pink500,
};

const pipelineStageLabels: { key: string; label: string; color: string }[] = [
  { key: "new_lead", label: "New Lead", color: Theme.primary },
  { key: "engaged", label: "Engaged", color: "#6366f1" },
  { key: "quoted", label: "Quoted", color: "#f59e0b" },
  { key: "paid", label: "Paid", color: Theme.success },
  { key: "booked", label: "Booked", color: "#10b981" },
  { key: "completed", label: "Completed", color: "#22c55e" },
];

// ===== HELPERS =====

function isInTimePeriod(dateStr: string, period: TimePeriod): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return date >= start;
    }
    case "week": {
      const day = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      return date >= start;
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= start;
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      return date >= start;
    }
  }
}

function getSAMData(lead: Lead): { score?: number; vertical?: string; company?: string } | null {
  const fd = lead.form_data;
  if (!fd) return null;
  const score = fd.sam_score ?? fd.score;
  const vertical = fd.vertical ?? fd.sam_vertical;
  const company = fd.company ?? fd.company_name ?? fd.sam_company;
  if (score === undefined && vertical === undefined && company === undefined) return null;
  return {
    score: typeof score === "number" ? score : undefined,
    vertical: typeof vertical === "string" ? vertical : undefined,
    company: typeof company === "string" ? company : undefined,
  };
}

// ===== MAIN COMPONENT =====

export default function LeadsScreen() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [showFunnel, setShowFunnel] = useState(true);
  const [showSourceChart, setShowSourceChart] = useState(true);
  const [showFormData, setShowFormData] = useState(false);

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

  // ===== TIME-FILTERED LEADS FOR METRICS =====

  const periodLeads = useMemo(() => {
    return leads.filter((l) => isInTimePeriod(l.created_at, timePeriod));
  }, [leads, timePeriod]);

  // ===== CLOSE RATE =====

  const closeRate = useMemo(() => {
    if (!periodLeads.length) return 0;
    const bookedCount = periodLeads.filter(
      (l) => l.status === "booked" || l.status === "assigned"
    ).length;
    return Math.round((bookedCount / periodLeads.length) * 100);
  }, [periodLeads]);

  // ===== AVERAGE LEAD VALUE =====

  const avgLeadValue = useMemo(() => {
    const withValue = periodLeads.filter((l) => l.estimated_value != null && l.estimated_value > 0);
    if (!withValue.length) return 0;
    const total = withValue.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
    return Math.round(total / withValue.length);
  }, [periodLeads]);

  // ===== SOURCE PERFORMANCE DATA =====

  const sourcePerformance = useMemo(() => {
    const map: Record<string, { total: number; booked: number; value: number }> = {};
    periodLeads.forEach((l) => {
      if (!map[l.source]) map[l.source] = { total: 0, booked: 0, value: 0 };
      map[l.source].total += 1;
      if (l.status === "booked" || l.status === "assigned") {
        map[l.source].booked += 1;
      }
      map[l.source].value += l.estimated_value ?? 0;
    });
    return map;
  }, [periodLeads]);

  const sourceChartData: BarChartItem[] = useMemo(() => {
    return Object.entries(sourcePerformance)
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([source, data]) => ({
        label: source,
        value: data.total,
        color: sourceColors[source] || Theme.primary,
        secondaryValue: data.booked,
        secondaryColor: Theme.success,
      }));
  }, [sourcePerformance]);

  const conversionBySource = useMemo(() => {
    return Object.entries(sourcePerformance)
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => {
        const rateA = a[1].total > 0 ? a[1].booked / a[1].total : 0;
        const rateB = b[1].total > 0 ? b[1].booked / b[1].total : 0;
        return rateB - rateA;
      })
      .map(([source, data]) => ({
        source,
        rate: data.total > 0 ? Math.round((data.booked / data.total) * 100) : 0,
        total: data.total,
        booked: data.booked,
      }));
  }, [sourcePerformance]);

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
  }, [leadsQuery, pipelineQuery]);

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFormData(false);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm((prev) => ({ ...prev, status: newStatus }));
    updateStatusMutation.mutate({ id: selectedLead.id, status: newStatus });
    setSelectedLead({ ...selectedLead, status: newStatus });
  };

  const handleSaveLead = () => {
    if (!selectedLead) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            {/* Time Period Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.periodList}
              contentContainerStyle={styles.periodListContent}
            >
              {timePeriods.map((tp) => (
                <TouchableOpacity
                  key={tp.key}
                  onPress={() => setTimePeriod(tp.key)}
                  style={[
                    styles.periodChip,
                    timePeriod === tp.key
                      ? styles.periodChipActive
                      : styles.periodChipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodChipText,
                      timePeriod === tp.key && styles.periodChipTextActive,
                    ]}
                  >
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
              <MetricCard
                title="Close Rate"
                value={`${closeRate}%`}
                icon="checkmark-circle-outline"
                iconColor={Theme.success}
                compact
              />
              <MetricCard
                title="Avg Value"
                value={`$${avgLeadValue}`}
                icon="cash-outline"
                iconColor={Theme.warning}
                compact
              />
              <MetricCard
                title="Leads"
                value={periodLeads.length}
                icon="people-outline"
                iconColor={Theme.primary}
                compact
              />
            </View>

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

            {/* Source Performance Chart */}
            <TouchableOpacity
              onPress={() => setShowSourceChart(!showSourceChart)}
              style={styles.sectionToggle}
            >
              <View style={styles.sectionToggleLeft}>
                <Ionicons name="bar-chart-outline" size={16} color={Theme.primary} />
                <Text style={styles.sectionToggleText}>Source Performance</Text>
              </View>
              <Ionicons
                name={showSourceChart ? "chevron-up" : "chevron-down"}
                size={16}
                color={Theme.mutedForeground}
              />
            </TouchableOpacity>
            {showSourceChart && (
              <GlassCard style={styles.chartCard}>
                {sourceChartData.length > 0 ? (
                  <>
                    <BarChart
                      data={sourceChartData}
                      height={180}
                      showValues
                      showLabels
                      title="Leads by Source"
                    />
                    {/* Conversion Rate by Source */}
                    <View style={styles.conversionSection}>
                      <Text style={styles.conversionTitle}>Conversion by Source</Text>
                      {conversionBySource.map((item) => (
                        <View key={item.source} style={styles.conversionRow}>
                          <View style={styles.conversionLabelRow}>
                            <Ionicons
                              name={sourceIcons[item.source] || "ellipse-outline"}
                              size={12}
                              color={sourceColors[item.source] || Theme.mutedForeground}
                            />
                            <Text style={styles.conversionSource} numberOfLines={1}>
                              {item.source}
                            </Text>
                          </View>
                          <View style={styles.conversionBarOuter}>
                            <View
                              style={[
                                styles.conversionBarInner,
                                {
                                  width: `${Math.max(item.rate, 2)}%`,
                                  backgroundColor:
                                    item.rate >= 50
                                      ? Theme.success
                                      : item.rate >= 25
                                      ? Theme.warning
                                      : Theme.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.conversionRate}>{item.rate}%</Text>
                          <Text style={styles.conversionCount}>
                            {item.booked}/{item.total}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyChartText}>
                    No source data for this period
                  </Text>
                )}
              </GlassCard>
            )}

            {/* Funnel Visualization */}
            <TouchableOpacity
              onPress={() => setShowFunnel(!showFunnel)}
              style={styles.sectionToggle}
            >
              <View style={styles.sectionToggleLeft}>
                <Ionicons name="funnel-outline" size={16} color={Theme.violet400} />
                <Text style={styles.sectionToggleText}>Pipeline Funnel</Text>
              </View>
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
        renderItem={({ item }) => {
          const samData = getSAMData(item);
          return (
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
                      {item.phone} {"\u2022"} {item.source}
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
                    {samData && (
                      <View style={styles.samBadgeInline}>
                        <Ionicons name="shield-checkmark-outline" size={11} color={Theme.emerald400} />
                        <Text style={styles.samBadgeInlineText}>
                          SAM{samData.score != null ? ` ${samData.score}` : ""}
                          {samData.company ? ` - ${samData.company}` : ""}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        }}
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
            {/* SAM Prospect Card */}
            {(() => {
              const samData = getSAMData(selectedLead);
              if (!samData) return null;
              return (
                <GlassCard style={styles.samCard}>
                  <View style={styles.samCardHeader}>
                    <View style={styles.samIconBox}>
                      <Ionicons name="shield-checkmark" size={16} color={Theme.emerald400} />
                    </View>
                    <Text style={styles.samCardTitle}>SAM Prospect</Text>
                  </View>
                  <View style={styles.samCardBody}>
                    {samData.score != null && (
                      <View style={styles.samField}>
                        <Text style={styles.samFieldLabel}>Score</Text>
                        <View style={styles.samScoreBadge}>
                          <Text style={styles.samScoreText}>{samData.score}</Text>
                        </View>
                      </View>
                    )}
                    {samData.vertical && (
                      <View style={styles.samField}>
                        <Text style={styles.samFieldLabel}>Vertical</Text>
                        <Text style={styles.samFieldValue}>{samData.vertical}</Text>
                      </View>
                    )}
                    {samData.company && (
                      <View style={styles.samField}>
                        <Text style={styles.samFieldLabel}>Company</Text>
                        <Text style={styles.samFieldValue}>{samData.company}</Text>
                      </View>
                    )}
                  </View>
                </GlassCard>
              );
            })()}

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

            {/* Form Data Expandable Section */}
            {selectedLead.form_data && Object.keys(selectedLead.form_data).length > 0 && (
              <View style={styles.formDataSection}>
                <TouchableOpacity
                  onPress={() => setShowFormData(!showFormData)}
                  style={styles.formDataToggle}
                >
                  <View style={styles.formDataToggleLeft}>
                    <Ionicons name="code-slash-outline" size={14} color={Theme.cyan400} />
                    <Text style={styles.formDataToggleText}>Form Data</Text>
                  </View>
                  <Ionicons
                    name={showFormData ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={Theme.mutedForeground}
                  />
                </TouchableOpacity>
                {showFormData && (
                  <View style={styles.formDataContent}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator
                      style={styles.formDataScroll}
                    >
                      <Text style={styles.formDataJson}>
                        {JSON.stringify(selectedLead.form_data, null, 2)}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

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

  // Time period selector
  periodList: {
    maxHeight: 44,
    paddingTop: 8,
  },
  periodListContent: {
    paddingHorizontal: 12,
    gap: 6,
  },
  periodChip: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  periodChipActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  periodChipInactive: {
    backgroundColor: "transparent",
    borderColor: Theme.border,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  periodChipTextActive: {
    color: Theme.primary,
  },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Section toggles
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },

  // Chart
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  emptyChartText: {
    fontSize: 13,
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },

  // Conversion rates
  conversionSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.borderSubtle,
  },
  conversionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  conversionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  conversionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
    gap: 4,
  },
  conversionSource: {
    fontSize: 11,
    color: Theme.mutedForeground,
    flex: 1,
  },
  conversionBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: Theme.muted,
    borderRadius: 4,
    marginHorizontal: 6,
    overflow: "hidden",
  },
  conversionBarInner: {
    height: "100%",
    borderRadius: 4,
    minWidth: 2,
  },
  conversionRate: {
    width: 32,
    fontSize: 11,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "right",
  },
  conversionCount: {
    width: 36,
    fontSize: 10,
    color: Theme.zinc400,
    textAlign: "right",
  },

  // Funnel
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
  samBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    backgroundColor: "rgba(52,211,153,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  samBadgeInlineText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.emerald400,
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

  // SAM Card
  samCard: {
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.2)",
  },
  samCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  samIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(52,211,153,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  samCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.emerald400,
  },
  samCardBody: {
    gap: 8,
  },
  samField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  samFieldLabel: {
    fontSize: 12,
    color: Theme.mutedForeground,
  },
  samFieldValue: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  samScoreBadge: {
    backgroundColor: "rgba(52,211,153,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  samScoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.emerald400,
  },

  // Form Data
  formDataSection: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.border,
    overflow: "hidden",
  },
  formDataToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Theme.muted,
  },
  formDataToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  formDataToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
  },
  formDataContent: {
    backgroundColor: Theme.background,
    padding: 12,
  },
  formDataScroll: {
    maxHeight: 240,
  },
  formDataJson: {
    fontFamily: "Courier",
    fontSize: 11,
    color: Theme.cyan400,
    lineHeight: 18,
  },
});
