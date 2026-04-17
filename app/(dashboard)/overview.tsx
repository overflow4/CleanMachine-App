import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import {
  fetchMetrics, fetchJobs, fetchAttentionNeeded, fetchLeads,
  fetchGhostHealth, fetchLeadSources, fetchCallTasks, fetchEarnings,
  fetchTeams, fetchPipeline, fetchNotifications, fetchLeaderboard,
  completeCallTask, apiFetch,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { BarChart } from "@/components/ui/charts/BarChart";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { FunnelChart } from "@/components/ui/charts/FunnelChart";
import { ProgressRing } from "@/components/ui/charts/ProgressRing";
import { Theme } from "@/constants/colors";
import { Job, AttentionItem, Lead } from "@/types";

interface CallTask {
  id: string;
  customer_name?: string;
  phone_number?: string;
  source?: string;
  category?: string;
  briefing?: string;
  completed?: boolean;
}

export default function OverviewScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  // ── Queries ──
  const metricsQuery = useQuery({ queryKey: ["metrics", "today"], queryFn: () => fetchMetrics("today") });
  const todaysJobsQuery = useQuery({
    queryKey: ["jobs", "today"],
    queryFn: () => { const today = new Date().toISOString().split("T")[0]; return fetchJobs({ date: today }); },
  });
  const attentionQuery = useQuery({ queryKey: ["attention-needed"], queryFn: fetchAttentionNeeded });
  const leadsQuery = useQuery({ queryKey: ["leads-recent"], queryFn: () => fetchLeads() });
  const callTasksQuery = useQuery({ queryKey: ["call-tasks"], queryFn: () => fetchCallTasks() });
  const ghostQuery = useQuery({ queryKey: ["ghost-health"], queryFn: fetchGhostHealth, retry: 1 });
  const leadSourcesQuery = useQuery({ queryKey: ["lead-sources"], queryFn: fetchLeadSources, retry: 1 });
  const earningsQuery = useQuery({ queryKey: ["earnings-week"], queryFn: () => fetchEarnings("week"), retry: 1 });
  const teamsQuery = useQuery({ queryKey: ["teams-overview"], queryFn: fetchTeams, retry: 1 });
  const pipelineQuery = useQuery({ queryKey: ["pipeline-overview"], queryFn: fetchPipeline, retry: 1 });
  const activityQuery = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => apiFetch("/api/system-events?limit=25"),
    retry: 1,
    refetchInterval: 30000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard-month"],
    queryFn: () => fetchLeaderboard("month"),
    retry: 1,
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => completeCallTask(taskId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["call-tasks"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      metricsQuery.refetch(), todaysJobsQuery.refetch(), attentionQuery.refetch(),
      leadsQuery.refetch(), callTasksQuery.refetch(), ghostQuery.refetch(),
      leadSourcesQuery.refetch(), earningsQuery.refetch(), teamsQuery.refetch(),
      pipelineQuery.refetch(), activityQuery.refetch(), leaderboardQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const toggleExpanded = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  // ── Derived data ──
  const metricsRaw: any = metricsQuery.data ?? {};
  const m: any = metricsRaw.data ?? metricsRaw;
  const jobs: Job[] = (todaysJobsQuery.data as any)?.data ?? [];
  const attentionItems: AttentionItem[] = (attentionQuery.data as any)?.items ?? [];
  const leadsRaw: any = leadsQuery.data ?? {};
  const leads: Lead[] = leadsRaw.data?.leads ?? leadsRaw.data ?? leadsRaw.leads ?? [];
  const callTasksRaw: any = callTasksQuery.data ?? {};
  const callTasks: CallTask[] = callTasksRaw.data?.tasks ?? callTasksRaw.data ?? callTasksRaw.tasks ?? [];

  const ghostRaw: any = ghostQuery.data ?? {};
  const ghost: any = ghostRaw.data ?? ghostRaw;

  const leadSourcesRaw: any = leadSourcesQuery.data ?? {};
  const leadSources: any[] = leadSourcesRaw.data?.sources ?? leadSourcesRaw.data ?? leadSourcesRaw.sources ?? [];

  const earningsRaw: any = earningsQuery.data ?? {};
  const earn: any = earningsRaw.data ?? earningsRaw;
  const weeklyTips = earn.tips ?? earn.total_tips ?? 0;
  const weeklyUpsells = earn.upsells ?? earn.total_upsells ?? 0;

  const teamsRaw: any = teamsQuery.data ?? {};
  const teamsList: any[] = teamsRaw.data?.teams ?? teamsRaw.data ?? teamsRaw.teams ?? [];

  const pipelineRaw: any = pipelineQuery.data ?? {};
  const pipeline: any = pipelineRaw.data ?? pipelineRaw;
  const funnelStages = useMemo(() => {
    if (!pipeline) return [];
    return [
      { label: "Leads", value: pipeline.total ?? pipeline.new ?? 0 },
      { label: "Contacted", value: pipeline.contacted ?? 0 },
      { label: "Qualified", value: pipeline.qualified ?? 0 },
      { label: "Booked", value: pipeline.booked ?? 0 },
    ].filter((s) => s.value > 0);
  }, [pipeline]);

  const activityRaw: any = activityQuery.data ?? {};
  const activityEvents: any[] = activityRaw.data?.events ?? activityRaw.data ?? activityRaw.events ?? [];

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activityEvents.slice(0, 15);
    return activityEvents.filter((e: any) => e.source === activityFilter).slice(0, 15);
  }, [activityEvents, activityFilter]);

  // Revenue goal (target $2000/day as a reasonable default)
  const leaderboardRaw: any = leaderboardQuery.data ?? {};
  const topPerformers: any[] = (leaderboardRaw.data?.rankings ?? leaderboardRaw.data ?? leaderboardRaw.rankings ?? []).slice(0, 3);

  const revenue = m.total_revenue ?? m.revenue ?? 0;
  const revenueGoal = m.daily_goal ?? 2000;
  const revenuePct = revenueGoal > 0 ? Math.round((revenue / revenueGoal) * 100) : 0;

  // Right Now counts
  const inProgress = jobs.filter((j) => j.status === "in_progress" || j.status === "in-progress").length;
  const scheduled = jobs.filter((j) => j.status === "scheduled" || j.status === "confirmed").length;
  const pendingAssignment = jobs.filter((j) => !j.cleaner_name && j.status !== "completed").length;
  const newLeadsCount = m.leads_in ?? m.leads ?? leads.filter((l) => l.status === "new").length;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />}
    >
      {/* Header */}
      <View style={st.header}>
        <Text style={st.pageTitle}>Command Center</Text>
        <Text style={st.dateText}>{today}</Text>
      </View>

      {/* Stats Cards */}
      <View style={st.statsRow}>
        <MetricCard title="Revenue" value={`$${revenue}`} icon="cash-outline" iconColor={Theme.success} />
        <MetricCard title="Jobs Done" value={String(m.jobs_completed ?? m.jobs ?? 0)} icon="checkmark-circle-outline" iconColor={Theme.primary} />
        <MetricCard title="New Leads" value={String(newLeadsCount)} icon="trending-up-outline" iconColor={Theme.warning} />
      </View>

      {/* Ghost Health */}
      {ghost && (ghost.pending_messages > 0 || ghost.unresponded_leads > 0 || ghost.watchdog_catches > 0) && (
        <GlassCard style={{ borderColor: Theme.destructive + "30" }}>
          <View style={st.sectionHeader}>
            <View style={st.ghostDot} />
            <Text style={[st.sectionTitle, { color: Theme.destructive }]}>Ghost Health</Text>
          </View>
          <View style={st.ghostGrid}>
            {ghost.pending_messages > 0 && (
              <View style={st.ghostItem}>
                <Text style={st.ghostValue}>{ghost.pending_messages}</Text>
                <Text style={st.ghostLabel}>Pending SMS</Text>
              </View>
            )}
            {ghost.unresponded_leads > 0 && (
              <View style={st.ghostItem}>
                <Text style={st.ghostValue}>{ghost.unresponded_leads}</Text>
                <Text style={st.ghostLabel}>Unresponded</Text>
              </View>
            )}
            {ghost.watchdog_catches > 0 && (
              <View style={st.ghostItem}>
                <Text style={st.ghostValue}>{ghost.watchdog_catches}</Text>
                <Text style={st.ghostLabel}>Catches</Text>
              </View>
            )}
            {ghost.watchdog_recoveries > 0 && (
              <View style={st.ghostItem}>
                <Text style={[st.ghostValue, { color: Theme.success }]}>{ghost.watchdog_recoveries}</Text>
                <Text style={st.ghostLabel}>Recoveries</Text>
              </View>
            )}
          </View>
        </GlassCard>
      )}

      {/* Right Now */}
      <GlassCard>
        <Text style={st.sectionTitle}>Right Now</Text>
        <View style={st.rightNowGrid}>
          <View style={st.rightNowItem}>
            <Ionicons name="play-circle" size={18} color={Theme.success} />
            <Text style={st.rightNowValue}>{inProgress}</Text>
            <Text style={st.rightNowLabel}>In Progress</Text>
          </View>
          <View style={st.rightNowItem}>
            <Ionicons name="calendar" size={18} color={Theme.primary} />
            <Text style={st.rightNowValue}>{scheduled}</Text>
            <Text style={st.rightNowLabel}>Scheduled</Text>
          </View>
          <View style={st.rightNowItem}>
            <Ionicons name="person-add" size={18} color={Theme.warning} />
            <Text style={st.rightNowValue}>{pendingAssignment}</Text>
            <Text style={st.rightNowLabel}>Unassigned</Text>
          </View>
          <View style={st.rightNowItem}>
            <Ionicons name="flash" size={18} color={Theme.violet400} />
            <Text style={st.rightNowValue}>{newLeadsCount}</Text>
            <Text style={st.rightNowLabel}>New Leads</Text>
          </View>
        </View>
      </GlassCard>

      {/* Revenue Goal Ring + Lead Funnel side by side */}
      <View style={st.twoCol}>
        <GlassCard style={{ flex: 1, alignItems: "center" }}>
          <Text style={st.sectionTitle}>Revenue Goal</Text>
          <ProgressRing
            progress={revenuePct}
            size={100}
            color={revenuePct >= 100 ? Theme.success : Theme.primary}
            value={`${Math.min(revenuePct, 999)}%`}
            label={`$${revenue} / $${revenueGoal}`}
          />
        </GlassCard>
        <GlassCard style={{ flex: 1 }}>
          <Text style={st.sectionTitle}>Lead Funnel</Text>
          {funnelStages.length > 0 ? (
            <FunnelChart stages={funnelStages} showDropoff />
          ) : (
            <Text style={st.emptyText}>No pipeline data</Text>
          )}
        </GlassCard>
      </View>

      {/* Lead Sources Chart */}
      {leadSources.length > 0 && (
        <GlassCard>
          <DonutChart
            data={leadSources.map((s: any, i: number) => ({
              label: s.source || s.name || "Unknown",
              value: s.count ?? s.value ?? 0,
              color: sourceColor(s.source || s.name || ""),
            }))}
            title="Lead Sources"
            centerValue={String(leadSources.reduce((sum: number, s: any) => sum + (s.count ?? s.value ?? 0), 0))}
            centerLabel="Total"
          />
        </GlassCard>
      )}

      {/* Attention Needed */}
      {attentionItems.length > 0 ? (
        <View style={st.section}>
          <View style={st.attentionHeader}>
            <View style={st.attentionDot} />
            <Text style={st.attentionTitle}>{attentionItems.length} items need attention</Text>
          </View>
          {attentionItems.slice(0, 5).map((item, i) => (
            <View key={item.id || i} style={[st.attentionItem, i === 0 && st.attentionItemFirst]}>
              <View style={[st.attentionIcon, { backgroundColor: typeColor(item.type) }]}>
                <Ionicons name={typeIcon(item.type)} size={16} color={typeIconColor(item.type)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle}>{item.title}</Text>
                <Text style={st.itemDesc}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={st.allClear}>
          <Ionicons name="checkmark-circle" size={20} color={Theme.success} />
          <Text style={{ fontSize: 13, color: Theme.success }}>All clear — no items need attention</Text>
        </View>
      )}

      {/* Team Status */}
      {teamsList.length > 0 && (
        <GlassCard>
          <Text style={st.sectionTitle}>Team Status</Text>
          {teamsList.slice(0, 6).map((team: any, i: number) => (
            <View key={team.id || i} style={st.teamRow}>
              <View style={[st.teamDot, { backgroundColor: team.status === "on-job" ? Theme.success : team.status === "available" ? Theme.primary : Theme.zinc500 }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle}>{team.name || team.team_lead_name || `Team ${i + 1}`}</Text>
                <Text style={st.itemDesc}>
                  {team.status || "unknown"}{team.current_job ? ` • ${team.current_job}` : ""}
                </Text>
              </View>
              {team.revenue != null && (
                <Text style={st.teamRevenue}>${team.revenue}</Text>
              )}
            </View>
          ))}
        </GlassCard>
      )}

      {/* Today's Jobs */}
      <GlassCard>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Today's Jobs</Text>
          <View style={st.pill}><Text style={st.pillText}>{jobs.length}</Text></View>
        </View>
        {jobs.length === 0 ? (
          <Text style={st.emptyText}>No jobs scheduled for today</Text>
        ) : (
          jobs.slice(0, 8).map((job, i) => (
            <View key={job.id || i} style={st.listItem}>
              <View style={[st.statusBar, { backgroundColor: statusBarColor(job.status) }]} />
              <View style={{ flex: 1 }}>
                <View style={st.row}>
                  <Text style={st.itemTitle}>{job.customer_name || job.phone_number || "Unnamed"}</Text>
                  <StatusBadge status={job.status || "scheduled"} />
                </View>
                <Text style={st.itemDesc}>
                  {[job.scheduled_time, job.service_type, job.address].filter(Boolean).join(" • ")}
                </Text>
                {job.price != null && <Text style={st.priceText}>${job.price}</Text>}
              </View>
            </View>
          ))
        )}
      </GlassCard>

      {/* Call Checklist */}
      <GlassCard>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Call Checklist</Text>
          <View style={st.pill}>
            <Text style={st.pillText}>{callTasks.filter((t) => !t.completed).length}</Text>
          </View>
        </View>
        {callTasks.length === 0 ? (
          <View style={st.callEmptyState}>
            <Ionicons name="call-outline" size={24} color={Theme.mutedForeground} />
            <Text style={st.emptyText}>No calls to make</Text>
          </View>
        ) : (
          callTasks.map((task, i) => {
            const isExpanded = expandedTasks.has(task.id);
            const isCompleted = task.completed;
            return (
              <View key={task.id || i} style={[st.callTaskItem, isCompleted && st.callTaskCompleted]}>
                <TouchableOpacity
                  onPress={() => { if (!isCompleted) completeTaskMutation.mutate(task.id); }}
                  style={st.checkButton} activeOpacity={0.6}
                >
                  <Ionicons
                    name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                    size={24} color={isCompleted ? Theme.success : Theme.mutedForeground}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={st.row}>
                    <Text style={[st.itemTitle, isCompleted && st.callTaskTextDone]}>
                      {task.customer_name || "Unknown"}
                    </Text>
                    {(task.source || task.category) && (
                      <View style={st.callCategoryPill}>
                        <Text style={st.callCategoryText}>{task.source || task.category}</Text>
                      </View>
                    )}
                  </View>
                  {task.phone_number && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${task.phone_number}`)} activeOpacity={0.6}>
                      <Text style={st.callPhoneText}>{task.phone_number}</Text>
                    </TouchableOpacity>
                  )}
                  {task.briefing && (
                    <TouchableOpacity onPress={() => toggleExpanded(task.id)} activeOpacity={0.7}>
                      <View style={st.briefingToggle}>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={Theme.mutedForeground} />
                        <Text style={st.briefingToggleText}>{isExpanded ? "Hide briefing" : "Show briefing"}</Text>
                      </View>
                      {isExpanded && <Text style={st.briefingText}>{task.briefing}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </GlassCard>

      {/* Weekly Earnings Summary */}
      {(weeklyTips > 0 || weeklyUpsells > 0) && (
        <GlassCard>
          <Text style={st.sectionTitle}>Weekly Earnings</Text>
          <View style={st.earningsRow}>
            <View style={st.earningsItem}>
              <Ionicons name="heart-outline" size={16} color={Theme.pink500} />
              <Text style={st.earningsLabel}>Tips</Text>
              <Text style={st.earningsValue}>${weeklyTips}</Text>
            </View>
            <View style={st.earningsItem}>
              <Ionicons name="arrow-up-circle-outline" size={16} color={Theme.emerald400} />
              <Text style={st.earningsLabel}>Upsells</Text>
              <Text style={st.earningsValue}>${weeklyUpsells}</Text>
            </View>
            <View style={st.earningsItem}>
              <Ionicons name="wallet-outline" size={16} color={Theme.primary} />
              <Text style={st.earningsLabel}>Total</Text>
              <Text style={st.earningsValue}>${weeklyTips + weeklyUpsells}</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <GlassCard>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Top Performers</Text>
            <Ionicons name="trophy" size={16} color={Theme.amber400} />
          </View>
          {topPerformers.map((p: any, i: number) => (
            <View key={p.id ?? p.name ?? i} style={st.teamRow}>
              <View style={[st.rankBadge, i === 0 && st.rankGold, i === 1 && st.rankSilver, i === 2 && st.rankBronze]}>
                <Text style={st.rankText}>{i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : "\uD83E\uDD49"}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={st.itemTitle}>{p.name ?? p.cleaner_name ?? `#${i + 1}`}</Text>
                <Text style={st.itemDesc}>${p.tips ?? p.revenue ?? 0} tips • {p.jobs ?? 0} jobs</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      )}

      {/* Recent Leads */}
      {leads.length > 0 && (
        <GlassCard>
          <Text style={st.sectionTitle}>Recent Leads</Text>
          {leads.slice(0, 5).map((lead, i) => (
            <View key={lead.id || i} style={st.listItem}>
              <View style={[st.sourceIcon, { backgroundColor: sourceBg(lead.source) }]}>
                <Ionicons name={sourceIcon(lead.source)} size={16} color={sourceColor(lead.source)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle}>{lead.name || lead.phone}</Text>
                <Text style={st.itemDesc}>{lead.source} • {lead.service_interest || ""}</Text>
              </View>
              <StatusBadge status={lead.status} />
            </View>
          ))}
        </GlassCard>
      )}

      {/* Activity Feed */}
      <GlassCard>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Activity Feed</Text>
          <TouchableOpacity onPress={() => activityQuery.refetch()}>
            <Ionicons name="refresh" size={16} color={Theme.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={st.filterRow}>
            {["all", "vapi", "openphone", "stripe", "system", "cron"].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setActivityFilter(f)}
                style={[st.filterChip, activityFilter === f && st.filterChipActive]}
              >
                <Text style={[st.filterChipText, activityFilter === f && st.filterChipTextActive]}>
                  {f === "all" ? "All" : f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        {filteredActivity.length === 0 ? (
          <Text style={st.emptyText}>No recent activity</Text>
        ) : (
          filteredActivity.map((evt: any, i: number) => (
            <View key={evt.id || i} style={st.activityItem}>
              <View style={[st.activityDot, { backgroundColor: eventColor(evt.source) }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.activityTitle} numberOfLines={1}>
                  {evt.event_type?.replace(/_/g, " ") || "Event"}
                </Text>
                <Text style={st.activityDesc} numberOfLines={1}>{evt.message || ""}</Text>
              </View>
              <Text style={st.activityTime}>{relTime(evt.created_at)}</Text>
            </View>
          ))
        )}
      </GlassCard>
    </ScrollView>
  );
}

// ── Helpers ──

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[st.badge, { backgroundColor: statusBg(status) }]}>
      <Text style={[st.badgeText, { color: statusColor(status) }]}>{status}</Text>
    </View>
  );
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 2) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const typeIcon = (t: string): keyof typeof Ionicons.glyphMap => ({ message: "chatbubble-outline", payment: "card-outline", cleaner: "person-outline", unassigned: "person-add-outline", quote: "document-text-outline" } as any)[t] || "alert-circle-outline";
const typeColor = (t: string) => ({ message: "rgba(96,165,250,0.15)", payment: "rgba(239,68,68,0.15)", cleaner: "rgba(249,115,22,0.15)", unassigned: "rgba(245,158,11,0.15)", quote: "rgba(139,92,246,0.15)" } as any)[t] || "rgba(139,92,246,0.15)";
const typeIconColor = (t: string) => ({ message: "#60a5fa", payment: "#f87171", cleaner: "#fb923c", unassigned: "#fbbf24", quote: "#a78bfa" } as any)[t] || "#a78bfa";
const statusBg = (s?: string) => ({ completed: "rgba(16,185,129,0.1)", in_progress: "rgba(0,145,255,0.1)", "in-progress": "rgba(0,145,255,0.1)", confirmed: "rgba(96,165,250,0.1)", scheduled: "rgba(113,113,122,0.1)", quoted: "rgba(245,158,11,0.1)", cancelled: "rgba(239,68,68,0.1)", new: "rgba(0,145,255,0.1)", contacted: "rgba(245,158,11,0.1)", booked: "rgba(16,185,129,0.1)", lost: "rgba(239,68,68,0.1)" } as any)[s || "scheduled"] || "rgba(113,113,122,0.1)";
const statusColor = (s?: string) => ({ completed: "#34d399", in_progress: "#0091ff", "in-progress": "#0091ff", confirmed: "#60a5fa", scheduled: "#71717a", quoted: "#fbbf24", cancelled: "#f87171", new: "#0091ff", contacted: "#fbbf24", booked: "#34d399", lost: "#f87171" } as any)[s || "scheduled"] || "#71717a";
const statusBarColor = (s?: string) => ({ completed: "#34d399", in_progress: "#0091ff", "in-progress": "#0091ff" } as any)[s || ""] || "#71717a";
const sourceIcon = (s: string): keyof typeof Ionicons.glyphMap => ({ phone: "call-outline", sms: "chatbubble-outline", meta: "logo-facebook", website: "globe-outline", google: "logo-google", thumbtack: "pin-outline", email: "mail-outline", vapi: "call-outline", hcp: "business-outline", housecall_pro: "business-outline", angi: "construct-outline" } as any)[s] || "person-outline";
const sourceBg = (s: string) => ({ phone: "rgba(0,145,255,0.15)", meta: "rgba(236,72,153,0.15)", website: "rgba(34,197,94,0.15)", google: "rgba(34,211,153,0.15)", thumbtack: "rgba(34,211,238,0.15)", vapi: "rgba(139,92,246,0.15)", hcp: "rgba(249,115,22,0.15)" } as any)[s] || "rgba(0,145,255,0.15)";
const sourceColor = (s: string) => ({ phone: "#0091ff", meta: "#ec4899", website: "#22c55e", google: "#34d399", thumbtack: "#22d3ee", vapi: "#a78bfa", sms: "#60a5fa", email: "#fbbf24", hcp: "#fb923c", housecall_pro: "#fb923c", angi: "#ef4444" } as any)[s] || "#0091ff";
const eventColor = (s?: string) => ({ vapi: "#a78bfa", openphone: "#0091ff", stripe: "#8b5cf6", telegram: "#22d3ee", system: "#71717a", cron: "#fbbf24", ghl: "#f97316", scheduler: "#34d399" } as any)[s || "system"] || "#71717a";

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pageTitle: { fontSize: 24, fontWeight: "700", color: Theme.foreground },
  dateText: { fontSize: 13, color: Theme.mutedForeground },
  statsRow: { flexDirection: "row", gap: 10 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: Theme.primaryMuted },
  pillText: { fontSize: 12, fontWeight: "600", color: Theme.primaryLight },
  emptyText: { fontSize: 14, color: Theme.mutedForeground, textAlign: "center", paddingVertical: 16 },

  // Ghost Health
  ghostDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.destructive, marginRight: 6 },
  ghostGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  ghostItem: { minWidth: 70, alignItems: "center" },
  ghostValue: { fontSize: 20, fontWeight: "700", color: Theme.warning },
  ghostLabel: { fontSize: 11, color: Theme.mutedForeground, marginTop: 2 },

  // Right Now
  rightNowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rightNowItem: { flex: 1, minWidth: 70, alignItems: "center", paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)" },
  rightNowValue: { fontSize: 20, fontWeight: "700", color: Theme.foreground, marginTop: 4 },
  rightNowLabel: { fontSize: 10, color: Theme.mutedForeground, marginTop: 2 },

  // Two-column layout
  twoCol: { flexDirection: "row", gap: 12 },

  // Attention
  attentionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  attentionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
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

  // Team status
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamRevenue: { fontSize: 13, fontWeight: "600", color: Theme.success },

  // Top performers
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Theme.zinc700, alignItems: "center", justifyContent: "center" },
  rankGold: { backgroundColor: "rgba(251,191,36,0.2)" },
  rankSilver: { backgroundColor: "rgba(148,163,184,0.2)" },
  rankBronze: { backgroundColor: "rgba(180,83,9,0.2)" },
  rankText: { fontSize: 14 },

  // Earnings
  earningsRow: { flexDirection: "row", gap: 8 },
  earningsItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)", gap: 4 },
  earningsLabel: { fontSize: 11, color: Theme.mutedForeground },
  earningsValue: { fontSize: 16, fontWeight: "700", color: Theme.foreground },

  // List items
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

  // Call Checklist
  callTaskItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Theme.glassListItem, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  callTaskCompleted: { opacity: 0.45 },
  callTaskTextDone: { textDecorationLine: "line-through" },
  checkButton: { paddingTop: 1 },
  callPhoneText: { fontSize: 13, color: Theme.primary, marginTop: 2, textDecorationLine: "underline" },
  callCategoryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(139,92,246,0.12)" },
  callCategoryText: { fontSize: 10, fontWeight: "600", color: "#a78bfa", textTransform: "capitalize" },
  callEmptyState: { alignItems: "center", gap: 6, paddingVertical: 20 },
  briefingToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  briefingToggleText: { fontSize: 12, color: Theme.mutedForeground },
  briefingText: { fontSize: 12, color: Theme.mutedForeground, marginTop: 6, lineHeight: 18 },

  // Activity Feed
  filterRow: { flexDirection: "row", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)" },
  filterChipActive: { backgroundColor: Theme.primaryMuted },
  filterChipText: { fontSize: 11, color: Theme.mutedForeground, textTransform: "capitalize" },
  filterChipTextActive: { color: Theme.primaryLight, fontWeight: "600" },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
  activityTitle: { fontSize: 12, fontWeight: "500", color: Theme.foreground, textTransform: "capitalize" },
  activityDesc: { fontSize: 11, color: Theme.mutedForeground, marginTop: 1 },
  activityTime: { fontSize: 10, color: Theme.zinc500, minWidth: 24, textAlign: "right" },
});
