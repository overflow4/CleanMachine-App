import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchInsightsLeads, fetchInsightsFunnel, fetchInsightsCrews,
  fetchInsightsPricing, fetchInsightsRetention, fetchInsightsRevenue,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { BarChart } from "@/components/ui/charts/BarChart";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { AreaChart } from "@/components/ui/charts/AreaChart";
import { FunnelChart } from "@/components/ui/charts/FunnelChart";
import { Theme } from "@/constants/colors";

type Tab = "leads" | "funnel" | "crews" | "pricing" | "retention" | "revenue";
type Range = "7d" | "30d" | "90d" | "ytd";

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "leads", label: "Leads", icon: "trending-up-outline" },
  { key: "funnel", label: "Funnel", icon: "funnel-outline" },
  { key: "crews", label: "Crews", icon: "people-outline" },
  { key: "pricing", label: "Pricing", icon: "pricetag-outline" },
  { key: "retention", label: "Retention", icon: "heart-outline" },
  { key: "revenue", label: "Revenue", icon: "cash-outline" },
];

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7D" }, { key: "30d", label: "30D" },
  { key: "90d", label: "90D" }, { key: "ytd", label: "YTD" },
];

const SRC_COLORS: Record<string, string> = {
  phone: Theme.primary, sms: Theme.blue400, meta: Theme.pink500,
  website: Theme.emerald400, google: "#34d399", thumbtack: Theme.cyan400,
  vapi: Theme.violet400, email: Theme.amber400, hcp: "#fb923c",
};

export default function InsightsScreen() {
  const [tab, setTab] = useState<Tab>("leads");
  const [range, setRange] = useState<Range>("30d");

  const leadsQ = useQuery({ queryKey: ["insights-leads", range], queryFn: () => fetchInsightsLeads(range), enabled: tab === "leads" });
  const funnelQ = useQuery({ queryKey: ["insights-funnel", range], queryFn: () => fetchInsightsFunnel(range), enabled: tab === "funnel" });
  const crewsQ = useQuery({ queryKey: ["insights-crews", range], queryFn: () => fetchInsightsCrews(range), enabled: tab === "crews" });
  const pricingQ = useQuery({ queryKey: ["insights-pricing", range], queryFn: () => fetchInsightsPricing(range), enabled: tab === "pricing" });
  const retentionQ = useQuery({ queryKey: ["insights-retention", range], queryFn: () => fetchInsightsRetention(range), enabled: tab === "retention" });
  const revenueQ = useQuery({ queryKey: ["insights-revenue", range], queryFn: () => fetchInsightsRevenue(range), enabled: tab === "revenue" });

  const activeQuery = { leads: leadsQ, funnel: funnelQ, crews: crewsQ, pricing: pricingQ, retention: retentionQ, revenue: revenueQ }[tab];
  const d: any = (activeQuery.data as any)?.data ?? activeQuery.data ?? {};

  const [crewSort, setCrewSort] = useState<"revenue" | "jobs" | "rating" | "tips">("revenue");

  const sortedTeams = useMemo(() => {
    const teams: any[] = d.teams ?? d.team_breakdown ?? [];
    return [...teams].sort((a, b) => (b[crewSort] ?? 0) - (a[crewSort] ?? 0));
  }, [d.teams, d.team_breakdown, crewSort]);

  return (
    <View style={st.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBar} contentContainerStyle={{ gap: 0 }}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { setTab(t.key); Haptics.selectionAsync(); }}
            style={[st.tab, tab === t.key && st.tabActive]}
          >
            <Ionicons name={t.icon} size={14} color={tab === t.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[st.tabText, tab === t.key && st.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date range picker */}
      <View style={st.rangeBar}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setRange(r.key)}
            style={[st.rangeChip, range === r.key && st.rangeChipActive]}
          >
            <Text style={[st.rangeText, range === r.key && st.rangeTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={activeQuery.isRefetching} onRefresh={() => activeQuery.refetch()} tintColor={Theme.primary} />}
      >
        {activeQuery.isLoading ? (
          <View style={st.center}><ActivityIndicator color={Theme.primary} /></View>
        ) : (
          <>
            {/* LEADS TAB */}
            {tab === "leads" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Total Leads" value={d.total_leads ?? d.total ?? 0} icon="people-outline" iconColor={Theme.primary} trend={d.leads_change} />
                  <MetricCard compact title="Conv. Rate" value={`${(d.conversion_rate ?? 0).toFixed(1)}%`} icon="checkmark-done-outline" iconColor={Theme.success} />
                </View>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Revenue" value={`$${d.revenue ?? 0}`} icon="cash-outline" iconColor={Theme.emerald400} />
                  <MetricCard compact title="Avg Response" value={`${d.avg_response_time ?? 0}m`} icon="timer-outline" iconColor={Theme.warning} />
                </View>
                {(d.sources ?? d.by_source ?? []).length > 0 && (
                  <GlassCard>
                    <DonutChart
                      data={(d.sources ?? d.by_source ?? []).map((s: any) => ({
                        label: s.source ?? s.name ?? "Unknown",
                        value: s.count ?? s.leads ?? 0,
                        color: SRC_COLORS[s.source ?? s.name] || Theme.zinc400,
                      }))}
                      title="Lead Distribution"
                      centerValue={String(d.total_leads ?? d.total ?? 0)}
                      centerLabel="Total"
                    />
                  </GlassCard>
                )}
                {(d.sources ?? d.by_source ?? []).length > 0 && (
                  <GlassCard>
                    <BarChart
                      data={(d.sources ?? d.by_source ?? []).map((s: any) => ({
                        label: s.source ?? s.name ?? "?",
                        value: s.count ?? s.leads ?? 0,
                        color: SRC_COLORS[s.source ?? s.name] || Theme.primary,
                      }))}
                      title="Leads by Source"
                      formatValue={(v) => String(v)}
                    />
                  </GlassCard>
                )}
              </>
            )}

            {/* FUNNEL TAB */}
            {tab === "funnel" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Overall Conv." value={`${(d.overall_conversion ?? d.conversion_rate ?? 0).toFixed(1)}%`} icon="funnel-outline" iconColor={Theme.primary} />
                  <MetricCard compact title="Avg Contact Time" value={`${d.avg_time_to_contact ?? 0}m`} icon="timer-outline" iconColor={Theme.warning} />
                </View>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Bottleneck" value={d.bottleneck_stage ?? "N/A"} icon="alert-circle-outline" iconColor={Theme.destructive} />
                  <MetricCard compact title="Time to Book" value={`${d.avg_time_to_book ?? 0}h`} icon="calendar-outline" iconColor={Theme.success} />
                </View>
                <GlassCard>
                  <FunnelChart
                    stages={(d.stages ?? d.funnel ?? [
                      { label: "Lead", value: d.leads ?? 0 },
                      { label: "Contacted", value: d.contacted ?? 0 },
                      { label: "Qualified", value: d.qualified ?? 0 },
                      { label: "Booked", value: d.booked ?? 0 },
                      { label: "Completed", value: d.completed ?? 0 },
                      { label: "Repeat", value: d.repeat ?? 0 },
                    ]).filter((s: any) => s.value > 0)}
                    title="Conversion Funnel"
                    showDropoff
                  />
                </GlassCard>
                {(d.stale_leads ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>Stale Leads (48h+)</Text>
                    {(d.stale_leads ?? []).slice(0, 10).map((l: any, i: number) => (
                      <View key={l.id ?? i} style={st.staleRow}>
                        <Text style={st.staleName}>{l.name ?? l.phone ?? "Unknown"}</Text>
                        <Text style={[st.staleDays, (l.days_since ?? 0) > 5 && { color: Theme.destructive }]}>
                          {l.days_since ?? "?"}d ago
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
              </>
            )}

            {/* CREWS TAB */}
            {tab === "crews" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Total Revenue" value={`$${d.total_revenue ?? 0}`} icon="cash-outline" iconColor={Theme.success} />
                  <MetricCard compact title="Avg Rating" value={(d.avg_rating ?? 0).toFixed(1)} icon="star-outline" iconColor={Theme.amber400} />
                </View>
                <GlassCard>
                  <View style={st.sortRow}>
                    <Text style={st.cardTitle}>Team Leaderboard</Text>
                    <View style={st.sortChips}>
                      {(["revenue", "jobs", "rating", "tips"] as const).map((s) => (
                        <TouchableOpacity key={s} onPress={() => setCrewSort(s)}
                          style={[st.sortChip, crewSort === s && st.sortChipActive]}>
                          <Text style={[st.sortChipText, crewSort === s && st.sortChipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {sortedTeams.map((team: any, i: number) => (
                    <View key={team.id ?? team.name ?? i} style={st.crewRow}>
                      <View style={[st.rankBadge, i === 0 && st.rankGold, i === 1 && st.rankSilver, i === 2 && st.rankBronze]}>
                        <Text style={st.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={st.crewName}>{team.name ?? team.team_name ?? `Team ${i + 1}`}</Text>
                        <Text style={st.crewMeta}>
                          {team.jobs ?? 0} jobs • ★{(team.rating ?? 0).toFixed(1)} • ${team.tips ?? 0} tips
                        </Text>
                      </View>
                      <Text style={st.crewRevenue}>${team.revenue ?? 0}</Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}

            {/* PRICING TAB */}
            {tab === "pricing" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Avg Job Price" value={`$${(d.avg_price ?? d.avg_job_price ?? 0).toFixed(0)}`} icon="pricetag-outline" iconColor={Theme.primary} />
                  <MetricCard compact title="Rev/Hour" value={`$${(d.revenue_per_hour ?? 0).toFixed(0)}`} icon="time-outline" iconColor={Theme.success} />
                </View>
                {d.top_addon && (
                  <MetricCard title="Top Add-On" value={d.top_addon} icon="add-circle-outline" iconColor={Theme.violet400} />
                )}
                {(d.price_trend ?? d.trend ?? []).length > 0 && (
                  <GlassCard>
                    <AreaChart
                      data={(d.price_trend ?? d.trend ?? []).map((p: any) => ({
                        label: p.date ?? p.label ?? "",
                        value: p.avg_price ?? p.value ?? 0,
                      }))}
                      title="Price Trend"
                      color={Theme.primary}
                    />
                  </GlassCard>
                )}
                {(d.addons ?? d.addon_performance ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>Add-on Performance</Text>
                    {(d.addons ?? d.addon_performance ?? []).map((a: any, i: number) => (
                      <View key={a.name ?? i} style={st.addonRow}>
                        <Text style={st.addonName}>{a.name ?? "Addon"}</Text>
                        <View style={st.addonBarBg}>
                          <View style={[st.addonBarFill, { width: `${Math.min((a.rate ?? a.attachment_rate ?? 0), 100)}%` }]} />
                        </View>
                        <Text style={st.addonRate}>{(a.rate ?? a.attachment_rate ?? 0).toFixed(0)}%</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
                {(d.tiers ?? d.tier_utilization ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>Tier Utilization</Text>
                    {(d.tiers ?? d.tier_utilization ?? []).map((t: any, i: number) => (
                      <View key={i} style={st.tierRow}>
                        <Text style={st.tierName}>{t.service ?? t.name ?? "Tier"}</Text>
                        <Text style={st.tierDetail}>{t.bedrooms}bd/{t.bathrooms}ba</Text>
                        <Text style={st.tierJobs}>{t.jobs ?? 0} jobs</Text>
                        <Text style={st.tierPrice}>${t.avg_price ?? t.price ?? 0}</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
              </>
            )}

            {/* RETENTION TAB */}
            {tab === "retention" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Health Score" value={`${(d.health_score ?? 0).toFixed(0)}%`} icon="heart-outline"
                    iconColor={(d.health_score ?? 0) > 70 ? Theme.success : Theme.warning} />
                  <MetricCard compact title="Repeat Rate" value={`${(d.repeat_rate ?? 0).toFixed(1)}%`} icon="repeat-outline" iconColor={Theme.primary} />
                </View>
                <View style={st.metricsRow}>
                  <MetricCard compact title="At-Risk" value={d.at_risk_count ?? 0} icon="warning-outline" iconColor={Theme.destructive} />
                  <MetricCard compact title="Retarget Conv." value={`${(d.retargeting_conversion ?? 0).toFixed(1)}%`} icon="refresh-outline" iconColor={Theme.violet400} />
                </View>
                {(d.lifecycle ?? d.lifecycle_distribution ?? []).length > 0 && (
                  <GlassCard>
                    <DonutChart
                      data={(d.lifecycle ?? d.lifecycle_distribution ?? []).map((s: any) => ({
                        label: s.stage ?? s.label ?? "Unknown",
                        value: s.count ?? s.value ?? 0,
                        color: lifecycleColor(s.stage ?? s.label),
                      }))}
                      title="Lifecycle Distribution"
                    />
                  </GlassCard>
                )}
                {(d.at_risk_customers ?? d.at_risk ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>At-Risk Customers</Text>
                    {(d.at_risk_customers ?? d.at_risk ?? []).slice(0, 10).map((c: any, i: number) => (
                      <View key={c.id ?? i} style={st.staleRow}>
                        <Text style={st.staleName}>{c.name ?? c.customer_name ?? "Unknown"}</Text>
                        <Text style={st.staleDays}>{c.days_since_last ?? c.gap_days ?? "?"}d gap</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
                {(d.recommendations ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>AI Recommendations</Text>
                    {(d.recommendations ?? []).map((r: any, i: number) => (
                      <View key={i} style={st.recRow}>
                        <Ionicons name="bulb-outline" size={16} color={Theme.amber400} />
                        <Text style={st.recText}>{typeof r === "string" ? r : r.message ?? r.text ?? ""}</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
              </>
            )}

            {/* REVENUE TAB */}
            {tab === "revenue" && (
              <>
                <View style={st.metricsRow}>
                  <MetricCard compact title="Total Revenue" value={`$${d.total_revenue ?? d.total ?? 0}`} icon="cash-outline" iconColor={Theme.success} trend={d.revenue_change} />
                  <MetricCard compact title="MRR" value={`$${d.mrr ?? 0}`} icon="repeat-outline" iconColor={Theme.primary} />
                </View>
                <View style={st.metricsRow}>
                  <MetricCard compact title="One-Time" value={`$${d.one_time_revenue ?? d.one_time ?? 0}`} icon="flash-outline" iconColor={Theme.warning} />
                  <MetricCard compact title="Est. Profit" value={`$${d.estimated_profit ?? d.profit ?? 0}`} icon="trending-up-outline" iconColor={Theme.emerald400} />
                </View>
                {(d.daily ?? d.daily_revenue ?? []).length > 0 && (
                  <GlassCard>
                    <AreaChart
                      data={(d.daily ?? d.daily_revenue ?? []).map((p: any) => ({
                        label: p.date ?? p.label ?? "",
                        value: p.recurring ?? p.value ?? 0,
                        secondaryValue: p.one_time ?? 0,
                      }))}
                      title="Daily Revenue"
                      color={Theme.primary}
                      secondaryColor={Theme.violet400}
                      stacked
                    />
                  </GlassCard>
                )}
                {(d.top_customers ?? []).length > 0 && (
                  <GlassCard>
                    <Text style={st.cardTitle}>Top Customers</Text>
                    {(d.top_customers ?? []).slice(0, 5).map((c: any, i: number) => (
                      <View key={c.id ?? i} style={st.crewRow}>
                        <View style={[st.rankBadge, i === 0 && st.rankGold, i === 1 && st.rankSilver, i === 2 && st.rankBronze]}>
                          <Text style={st.rankText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={st.crewName}>{c.name ?? c.customer_name ?? "Unknown"}</Text>
                          <Text style={st.crewMeta}>{c.jobs ?? 0} jobs</Text>
                        </View>
                        <Text style={st.crewRevenue}>${c.revenue ?? 0}</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
                {(d.monthly_trend ?? d.monthly ?? []).length > 0 && (
                  <GlassCard>
                    <BarChart
                      data={(d.monthly_trend ?? d.monthly ?? []).map((m: any) => ({
                        label: m.month ?? m.label ?? "",
                        value: m.recurring ?? m.revenue ?? 0,
                        secondaryValue: m.one_time ?? 0,
                        secondaryColor: Theme.violet400,
                      }))}
                      title="12-Month Trend"
                      formatValue={(v) => `$${v}`}
                    />
                  </GlassCard>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const lifecycleColor = (stage?: string) => {
  const map: Record<string, string> = {
    active: Theme.success, repeat: Theme.primary, "one-time": Theme.warning,
    lapsed: Theme.destructive, "quoted-not-booked": Theme.amber400, new: Theme.info,
    lost: Theme.red400, unresponsive: Theme.zinc500,
  };
  return map[stage ?? ""] ?? Theme.zinc400;
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  tabBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  tab: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 12, paddingHorizontal: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Theme.primary },
  tabText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  rangeBar: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Theme.card, borderBottomWidth: 1, borderBottomColor: Theme.border },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)" },
  rangeChipActive: { backgroundColor: Theme.primaryMuted },
  rangeText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  rangeTextActive: { color: Theme.primaryLight, fontWeight: "600" },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { paddingVertical: 60, alignItems: "center" },
  metricsRow: { flexDirection: "row", gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  staleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  staleName: { fontSize: 13, color: Theme.foreground },
  staleDays: { fontSize: 12, color: Theme.warning, fontWeight: "600" },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sortChips: { flexDirection: "row", gap: 4 },
  sortChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.04)" },
  sortChipActive: { backgroundColor: Theme.primaryMuted },
  sortChipText: { fontSize: 10, color: Theme.mutedForeground, textTransform: "capitalize" },
  sortChipTextActive: { color: Theme.primaryLight, fontWeight: "600" },
  crewRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Theme.zinc700, alignItems: "center", justifyContent: "center" },
  rankGold: { backgroundColor: "rgba(251,191,36,0.2)" },
  rankSilver: { backgroundColor: "rgba(148,163,184,0.2)" },
  rankBronze: { backgroundColor: "rgba(180,83,9,0.2)" },
  rankText: { fontSize: 12, fontWeight: "700", color: Theme.foreground },
  crewName: { fontSize: 13, fontWeight: "500", color: Theme.foreground },
  crewMeta: { fontSize: 11, color: Theme.mutedForeground, marginTop: 2 },
  crewRevenue: { fontSize: 14, fontWeight: "700", color: Theme.success },
  addonRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addonName: { fontSize: 12, color: Theme.foreground, width: 80 },
  addonBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  addonBarFill: { height: "100%", borderRadius: 4, backgroundColor: Theme.primary },
  addonRate: { fontSize: 11, fontWeight: "600", color: Theme.mutedForeground, width: 36, textAlign: "right" },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  tierName: { flex: 1, fontSize: 12, color: Theme.foreground },
  tierDetail: { fontSize: 11, color: Theme.mutedForeground, width: 60 },
  tierJobs: { fontSize: 11, color: Theme.zinc400, width: 50, textAlign: "right" },
  tierPrice: { fontSize: 12, fontWeight: "600", color: Theme.success, width: 50, textAlign: "right" },
  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  recText: { flex: 1, fontSize: 13, color: Theme.foreground, lineHeight: 18 },
});
