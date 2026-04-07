import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { fetchMetrics, fetchJobs, fetchAttentionNeeded, fetchLeads } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Theme } from "@/constants/colors";
import { Job, AttentionItem, Lead } from "@/types";

export default function OverviewScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const metricsQuery = useQuery({
    queryKey: ["metrics", "today"],
    queryFn: () => fetchMetrics("today"),
  });

  const todaysJobsQuery = useQuery({
    queryKey: ["jobs", "today"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0];
      return fetchJobs({ date: today });
    },
  });

  const attentionQuery = useQuery({
    queryKey: ["attention-needed"],
    queryFn: fetchAttentionNeeded,
  });

  const leadsQuery = useQuery({
    queryKey: ["leads-recent"],
    queryFn: () => fetchLeads(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      metricsQuery.refetch(),
      todaysJobsQuery.refetch(),
      attentionQuery.refetch(),
      leadsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const metricsRaw: any = metricsQuery.data ?? {};
  const metrics: any = metricsRaw.data ?? metricsRaw;
  const jobs: Job[] = (todaysJobsQuery.data as any)?.data ?? [];
  const attentionItems: AttentionItem[] = (attentionQuery.data as any)?.items ?? [];
  const leadsRaw: any = leadsQuery.data ?? {};
  const leads: Lead[] = leadsRaw.data?.leads ?? leadsRaw.data ?? leadsRaw.leads ?? [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Command Center</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <StatCard title="Today's Revenue" value={`$${metrics.total_revenue ?? metrics.revenue ?? 0}`} icon="cash-outline" />
        <StatCard title="Jobs Completed" value={String(metrics.jobs_completed ?? metrics.jobs ?? 0)} icon="checkmark-circle-outline" />
        <StatCard title="New Leads" value={String(metrics.leads_in ?? metrics.leads ?? 0)} icon="trending-up-outline" />
      </View>

      {/* Attention Needed */}
      {attentionItems.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.attentionHeader}>
            <View style={styles.attentionDotOuter}><View style={styles.attentionDotInner} /></View>
            <Text style={styles.attentionTitle}>{attentionItems.length} items need attention</Text>
          </View>
          {attentionItems.slice(0, 5).map((item, i) => (
            <View key={item.id || i} style={[styles.attentionItem, i === 0 && styles.attentionItemFirst]}>
              <View style={[styles.attentionIcon, { backgroundColor: typeColor(item.type) }]}>
                <Ionicons name={typeIcon(item.type)} size={16} color={typeIconColor(item.type)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.allClear}>
          <Ionicons name="checkmark-circle" size={20} color={Theme.success} />
          <Text style={{ fontSize: 13, color: Theme.success }}>All clear — no items need attention</Text>
        </View>
      )}

      {/* Today's Jobs */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Jobs</Text>
          <View style={styles.pill}><Text style={styles.pillText}>{jobs.length}</Text></View>
        </View>
        {jobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs scheduled for today</Text>
        ) : (
          jobs.slice(0, 8).map((job, i) => (
            <View key={job.id || i} style={styles.listItem}>
              <View style={[styles.statusBar, { backgroundColor: statusBarColor(job.status) }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{job.customer_name || job.phone_number || "Unnamed"}</Text>
                  <StatusBadge status={job.status || "scheduled"} />
                </View>
                <Text style={styles.itemDesc}>
                  {[job.scheduled_time, job.service_type, job.address].filter(Boolean).join(" • ")}
                </Text>
                {job.price != null && <Text style={styles.priceText}>${job.price}</Text>}
              </View>
            </View>
          ))
        )}
      </GlassCard>

      {/* Recent Leads */}
      {leads.length > 0 && (
        <GlassCard>
          <Text style={styles.sectionTitle}>Recent Leads</Text>
          {leads.slice(0, 5).map((lead, i) => (
            <View key={lead.id || i} style={styles.listItem}>
              <View style={[styles.sourceIcon, { backgroundColor: sourceBg(lead.source) }]}>
                <Ionicons name={sourceIcon(lead.source)} size={16} color={sourceColor(lead.source)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{lead.name || lead.phone}</Text>
                <Text style={styles.itemDesc}>{lead.source} • {lead.service_interest || ""}</Text>
              </View>
              <StatusBadge status={lead.status} />
            </View>
          ))}
        </GlassCard>
      )}
    </ScrollView>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <GlassCard style={{ flex: 1, padding: 16 }}>
      <View style={[styles.statIconBox, { backgroundColor: "rgba(0,145,255,0.1)" }]}>
        <Ionicons name={icon} size={20} color={Theme.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: statusBg(status) }]}>
      <Text style={[styles.badgeText, { color: statusColor(status) }]}>{status}</Text>
    </View>
  );
}

// Color helpers
const typeIcon = (t: string): keyof typeof Ionicons.glyphMap => ({ message: "chatbubble-outline", payment: "card-outline", cleaner: "person-outline", unassigned: "person-add-outline", quote: "document-text-outline" } as any)[t] || "alert-circle-outline";
const typeColor = (t: string) => ({ message: "rgba(96,165,250,0.15)", payment: "rgba(239,68,68,0.15)", cleaner: "rgba(249,115,22,0.15)", unassigned: "rgba(245,158,11,0.15)", quote: "rgba(139,92,246,0.15)" } as any)[t] || "rgba(139,92,246,0.15)";
const typeIconColor = (t: string) => ({ message: "#60a5fa", payment: "#f87171", cleaner: "#fb923c", unassigned: "#fbbf24", quote: "#a78bfa" } as any)[t] || "#a78bfa";
const statusBg = (s?: string) => ({ completed: "rgba(16,185,129,0.1)", in_progress: "rgba(0,145,255,0.1)", "in-progress": "rgba(0,145,255,0.1)", confirmed: "rgba(96,165,250,0.1)", scheduled: "rgba(113,113,122,0.1)", quoted: "rgba(245,158,11,0.1)", cancelled: "rgba(239,68,68,0.1)", new: "rgba(0,145,255,0.1)", contacted: "rgba(245,158,11,0.1)", booked: "rgba(16,185,129,0.1)", lost: "rgba(239,68,68,0.1)" } as any)[s || "scheduled"] || "rgba(113,113,122,0.1)";
const statusColor = (s?: string) => ({ completed: "#34d399", in_progress: "#0091ff", "in-progress": "#0091ff", confirmed: "#60a5fa", scheduled: "#71717a", quoted: "#fbbf24", cancelled: "#f87171", new: "#0091ff", contacted: "#fbbf24", booked: "#34d399", lost: "#f87171" } as any)[s || "scheduled"] || "#71717a";
const statusBarColor = (s?: string) => ({ completed: "#34d399", in_progress: "#0091ff", "in-progress": "#0091ff" } as any)[s || ""] || "#71717a";
const sourceIcon = (s: string): keyof typeof Ionicons.glyphMap => ({ phone: "call-outline", sms: "chatbubble-outline", meta: "logo-facebook", website: "globe-outline", google: "logo-google", thumbtack: "pin-outline", email: "mail-outline", vapi: "call-outline" } as any)[s] || "person-outline";
const sourceBg = (s: string) => ({ phone: "rgba(0,145,255,0.15)", meta: "rgba(236,72,153,0.15)", website: "rgba(34,197,94,0.15)", google: "rgba(34,211,153,0.15)", thumbtack: "rgba(34,211,238,0.15)" } as any)[s] || "rgba(0,145,255,0.15)";
const sourceColor = (s: string) => ({ phone: "#0091ff", meta: "#ec4899", website: "#22c55e", google: "#34d399", thumbtack: "#22d3ee" } as any)[s] || "#0091ff";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pageTitle: { fontSize: 24, fontWeight: "700", color: Theme.foreground },
  dateText: { fontSize: 13, color: Theme.mutedForeground },
  statsRow: { flexDirection: "row", gap: 12 },
  statIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontWeight: "700", color: Theme.violet300, marginTop: 12 },
  statLabel: { fontSize: 13, fontWeight: "500", color: Theme.zinc400, marginTop: 2 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: Theme.primaryMuted },
  pillText: { fontSize: 12, fontWeight: "600", color: Theme.primaryLight },
  emptyText: { fontSize: 14, color: Theme.mutedForeground, textAlign: "center", paddingVertical: 16 },
  attentionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  attentionDotOuter: { width: 10, height: 10, borderRadius: 5 },
  attentionDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  attentionTitle: { fontSize: 14, fontWeight: "600", color: Theme.foreground },
  attentionItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, minHeight: 56,
    backgroundColor: "rgba(30,28,36,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  attentionItemFirst: { backgroundColor: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.15)" },
  attentionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  allClear: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(16,185,129,0.2)", backgroundColor: "rgba(16,185,129,0.05)",
  },
  listItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Theme.glassListItem, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  statusBar: { width: 3, borderRadius: 2, alignSelf: "stretch", minHeight: 32 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground, flex: 1 },
  itemDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  priceText: { fontSize: 13, fontWeight: "600", color: "#34d399", marginTop: 4 },
  sourceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
});
