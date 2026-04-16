import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchRetargetingCustomers, fetchRetargetingPipeline, fetchRetargetingAbResults } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { FunnelChart } from "@/components/ui/charts/FunnelChart";
import { BarChart } from "@/components/ui/charts/BarChart";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

type Tab = "customers" | "pipeline" | "ab_results";

export default function RetargetingScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("customers");
  const [search, setSearch] = useState("");

  const customersQuery = useQuery({
    queryKey: ["retargeting-customers"],
    queryFn: fetchRetargetingCustomers,
    enabled: activeTab === "customers",
  });

  const pipelineQuery = useQuery({
    queryKey: ["retargeting-pipeline"],
    queryFn: fetchRetargetingPipeline,
    enabled: activeTab === "pipeline",
  });

  const abQuery = useQuery({
    queryKey: ["retargeting-ab"],
    queryFn: fetchRetargetingAbResults,
    enabled: activeTab === "ab_results",
  });

  const customers: any[] = (customersQuery.data as any)?.data ?? (customersQuery.data as any)?.customers ?? [];
  const pipelineRaw: any = pipelineQuery.data ?? {};
  const pipeline: any = pipelineRaw.data ?? pipelineRaw;
  const abResults: any[] = (abQuery.data as any)?.data ?? (abQuery.data as any)?.results ?? [];

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter((c: any) =>
      (c.first_name || c.name || "").toLowerCase().includes(q) ||
      (c.phone_number || "").includes(q) ||
      (c.last_name || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Pipeline stages for funnel
  const pipelineStages = useMemo(() => {
    if (!pipeline || typeof pipeline !== "object") return [];
    const stages: { label: string; value: number }[] = [];
    const stageOrder = ["enrolled", "in_sequence", "contacted", "responded", "converted", "completed"];
    for (const key of stageOrder) {
      if (pipeline[key] != null) {
        stages.push({ label: key.replace(/_/g, " "), value: pipeline[key]?.count ?? pipeline[key] ?? 0 });
      }
    }
    if (stages.length === 0) {
      for (const [key, val] of Object.entries(pipeline)) {
        if (val && typeof val === "object" && (val as any).count != null) {
          stages.push({ label: key.replace(/_/g, " "), value: (val as any).count });
        }
      }
    }
    return stages;
  }, [pipeline]);

  // Pipeline summary metrics
  const totalInSequence = pipelineStages.reduce((sum, s) => sum + s.value, 0);
  const convertedCount = pipelineStages.find((s) => s.label.includes("convert"))?.value ?? 0;
  const conversionRate = totalInSequence > 0 ? ((convertedCount / totalInSequence) * 100).toFixed(1) : "0";

  const isLoading =
    (activeTab === "customers" && customersQuery.isLoading) ||
    (activeTab === "pipeline" && pipelineQuery.isLoading) ||
    (activeTab === "ab_results" && abQuery.isLoading);

  const onRefresh = async () => {
    if (activeTab === "customers") await customersQuery.refetch();
    else if (activeTab === "pipeline") await pipelineQuery.refetch();
    else await abQuery.refetch();
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "customers", label: "Customers", icon: "people-outline" },
    { key: "pipeline", label: "Pipeline", icon: "funnel-outline" },
    { key: "ab_results", label: "A/B Results", icon: "flask-outline" },
  ];

  return (
    <View style={st.container}>
      {/* Tab bar */}
      <View style={st.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            style={[st.tab, activeTab === tab.key && st.tabActive]}
          >
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={st.scrollContent}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Theme.primary} />}
      >
        {isLoading ? (
          <LoadingScreen message="Loading..." />
        ) : (
          <>
            {/* ── CUSTOMERS TAB ── */}
            {activeTab === "customers" && (
              <>
                {/* Search */}
                <View style={st.searchRow}>
                  <Ionicons name="search" size={16} color={Theme.mutedForeground} />
                  <TextInput
                    style={st.searchInput}
                    placeholder="Search customers..."
                    placeholderTextColor={Theme.mutedForeground}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                {/* Summary */}
                <View style={st.metricsRow}>
                  <MetricCard compact title="Total" value={customers.length} icon="people-outline" iconColor={Theme.primary} />
                  <MetricCard compact title="With Service" value={customers.filter((c: any) => c.last_service_date).length} icon="checkmark-circle-outline" iconColor={Theme.success} />
                </View>

                {filteredCustomers.length === 0 ? (
                  <EmptyState icon="refresh-outline" title="No retargeting customers" description={search ? "No matches" : "Customers will appear when enrolled"} />
                ) : (
                  filteredCustomers.map((c: any, i: number) => (
                    <GlassCard key={c.id ?? i} style={st.card}>
                      <View style={st.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={st.nameText}>
                            {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.name || c.phone_number || "Customer"}
                          </Text>
                          <Text style={st.subText}>{c.phone_number || ""}</Text>
                        </View>
                        {c.lifecycle_stage && (
                          <View style={[st.badge, { backgroundColor: lifecycleBg(c.lifecycle_stage) }]}>
                            <Text style={[st.badgeText, { color: lifecycleColor(c.lifecycle_stage) }]}>{c.lifecycle_stage}</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.detailRow}>
                        {c.last_service_date && (
                          <Text style={st.detailText}>Last service: {new Date(c.last_service_date).toLocaleDateString()}</Text>
                        )}
                        {c.days_since_service != null && (
                          <Text style={[st.detailText, c.days_since_service > 60 && { color: Theme.warning }]}>
                            {c.days_since_service}d ago
                          </Text>
                        )}
                        {c.sequence && (
                          <Text style={st.detailText}>Seq: {c.sequence}</Text>
                        )}
                        {c.sequence_step != null && (
                          <Text style={st.detailText}>Step {c.sequence_step}</Text>
                        )}
                      </View>
                    </GlassCard>
                  ))
                )}
              </>
            )}

            {/* ── PIPELINE TAB ── */}
            {activeTab === "pipeline" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="In Sequence" value={totalInSequence} icon="refresh-outline" iconColor={Theme.primary} />
                  <MetricCard compact title="Converted" value={convertedCount} icon="checkmark-done-outline" iconColor={Theme.success} />
                  <MetricCard compact title="Conv. Rate" value={`${conversionRate}%`} icon="trending-up-outline" iconColor={Theme.violet400} />
                </View>

                {pipelineStages.length > 0 ? (
                  <GlassCard>
                    <FunnelChart stages={pipelineStages} title="Retargeting Pipeline" showDropoff />
                  </GlassCard>
                ) : (
                  <EmptyState icon="funnel-outline" title="No pipeline data" />
                )}

                {/* Stage detail cards */}
                {pipelineStages.map((stage, i) => (
                  <GlassCard key={i} style={st.card}>
                    <View style={st.rowBetween}>
                      <Text style={[st.stageText, { textTransform: "capitalize" }]}>{stage.label}</Text>
                      <View style={[st.badge, { backgroundColor: Theme.primaryMuted }]}>
                        <Text style={[st.badgeText, { color: Theme.primaryLight }]}>{stage.value}</Text>
                      </View>
                    </View>
                  </GlassCard>
                ))}
              </>
            )}

            {/* ── A/B RESULTS TAB ── */}
            {activeTab === "ab_results" && (
              <>
                {abResults.length === 0 ? (
                  <EmptyState icon="flask-outline" title="No A/B test results" description="Results will appear when tests complete" />
                ) : (
                  <>
                    {/* Summary chart */}
                    <GlassCard>
                      <BarChart
                        data={abResults.slice(0, 6).flatMap((r: any, i: number) => [
                          { label: `${(r.name || `Test ${i + 1}`).slice(0, 6)} A`, value: r.variant_a_converted ?? r.variant_a_rate ?? 0, color: Theme.primary },
                          { label: `${(r.name || `Test ${i + 1}`).slice(0, 6)} B`, value: r.variant_b_converted ?? r.variant_b_rate ?? 0, color: Theme.violet400 },
                        ])}
                        title="A/B Conversion Comparison"
                      />
                    </GlassCard>

                    {abResults.map((result: any, i: number) => {
                      const aRate = result.variant_a_rate ?? result.variant_a_converted ?? 0;
                      const bRate = result.variant_b_rate ?? result.variant_b_converted ?? 0;
                      const winner = aRate > bRate ? "A" : bRate > aRate ? "B" : null;

                      return (
                        <GlassCard key={result.id ?? i} style={st.card}>
                          <Text style={st.nameText}>{result.name || result.sequence || `Test ${i + 1}`}</Text>
                          {result.description && <Text style={st.subText}>{result.description}</Text>}

                          {/* Metrics row */}
                          <View style={st.abMetrics}>
                            {result.enrolled != null && (
                              <View style={st.abMetricItem}>
                                <Text style={st.abMetricValue}>{result.enrolled}</Text>
                                <Text style={st.abMetricLabel}>Enrolled</Text>
                              </View>
                            )}
                            {result.replied != null && (
                              <View style={st.abMetricItem}>
                                <Text style={st.abMetricValue}>{result.replied}</Text>
                                <Text style={st.abMetricLabel}>Replied</Text>
                              </View>
                            )}
                            {result.converted != null && (
                              <View style={st.abMetricItem}>
                                <Text style={[st.abMetricValue, { color: Theme.success }]}>{result.converted}</Text>
                                <Text style={st.abMetricLabel}>Converted</Text>
                              </View>
                            )}
                          </View>

                          {/* Variant comparison */}
                          <View style={st.variantRow}>
                            <View style={[st.variantCard, winner === "A" && st.variantWinner]}>
                              <View style={st.variantHeader}>
                                <View style={[st.variantBadge, { backgroundColor: Theme.primaryMuted }]}>
                                  <Text style={[st.variantBadgeText, { color: Theme.primaryLight }]}>A</Text>
                                </View>
                                {winner === "A" && <Ionicons name="trophy" size={14} color={Theme.amber400} />}
                              </View>
                              <Text style={st.variantRate}>{aRate}%</Text>
                              {result.variant_a_template && (
                                <Text style={st.variantTemplate} numberOfLines={2}>{result.variant_a_template}</Text>
                              )}
                            </View>
                            <View style={[st.variantCard, winner === "B" && st.variantWinner]}>
                              <View style={st.variantHeader}>
                                <View style={[st.variantBadge, { backgroundColor: "rgba(167,139,250,0.15)" }]}>
                                  <Text style={[st.variantBadgeText, { color: Theme.violet400 }]}>B</Text>
                                </View>
                                {winner === "B" && <Ionicons name="trophy" size={14} color={Theme.amber400} />}
                              </View>
                              <Text style={st.variantRate}>{bRate}%</Text>
                              {result.variant_b_template && (
                                <Text style={st.variantTemplate} numberOfLines={2}>{result.variant_b_template}</Text>
                              )}
                            </View>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const lifecycleBg = (stage: string) => ({ active: Theme.successBg, lapsed: Theme.warningBg, lost: Theme.destructiveBg, "one-time": "rgba(0,145,255,0.1)" } as any)[stage] ?? "rgba(113,113,122,0.1)";
const lifecycleColor = (stage: string) => ({ active: Theme.success, lapsed: Theme.warning, lost: Theme.destructive, "one-time": Theme.info } as any)[stage] ?? Theme.zinc400;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  tabBar: { flexDirection: "row", gap: 0, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Theme.primary },
  tabText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  scrollContent: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  card: { marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingHorizontal: 12, height: 38, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: Theme.foreground, height: 38 },
  nameText: { fontWeight: "500", color: Theme.foreground, fontSize: 14 },
  subText: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stageText: { fontWeight: "500", color: Theme.foreground },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  detailText: { fontSize: 11, color: Theme.zinc400 },

  // A/B Results
  abMetrics: { flexDirection: "row", gap: 16, marginTop: 10, marginBottom: 8 },
  abMetricItem: { alignItems: "center" },
  abMetricValue: { fontSize: 18, fontWeight: "700", color: Theme.foreground },
  abMetricLabel: { fontSize: 10, color: Theme.mutedForeground, marginTop: 2 },
  variantRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  variantCard: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  variantWinner: { borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.04)" },
  variantHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  variantBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  variantBadgeText: { fontSize: 11, fontWeight: "700" },
  variantRate: { fontSize: 20, fontWeight: "700", color: Theme.foreground },
  variantTemplate: { fontSize: 11, color: Theme.mutedForeground, marginTop: 4 },
});
