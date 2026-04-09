import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCrewDashboard, toggleTimeOff, CrewJob } from "@/lib/crew-api";
import { getCrewToken, setCrewToken, clearCrewToken } from "@/lib/crew-store";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

type ViewMode = "day" | "week";

export default function CrewDashboardScreen() {
  const params = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(params.token || null);

  // Persist token and restore from storage
  useEffect(() => {
    if (params.token) {
      setCrewToken(params.token);
      setToken(params.token);
    } else {
      getCrewToken().then((stored) => {
        if (stored) setToken(stored);
        else router.replace("/"); // no token, go to login
      });
    }
  }, [params.token]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedJob, setSelectedJob] = useState<CrewJob | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["crew-dashboard", token, viewMode, date],
    queryFn: () => fetchCrewDashboard(token!, viewMode, date),
    enabled: !!token,
  });

  const cleaner = data?.cleaner;
  const tenant = data?.tenant;
  const jobs = data?.jobs ?? [];
  const pendingJobs = data?.pendingJobs ?? [];
  const timeOffDates = new Set((data?.timeOff ?? []).map((t) => t.date));

  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + (viewMode === "week" ? 7 * dir : dir));
    setDate(d.toISOString().split("T")[0]);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = cleaner?.name?.split(" ")[0] || "there";

  const statusColor = (job: CrewJob) => {
    if (job.status === "completed") return Theme.success;
    if (job.cleaner_arrived_at) return "#f59e0b";
    if (job.cleaner_omw_at) return Theme.primary;
    if (job.assignment_status === "pending") return "#f97316";
    return Theme.mutedForeground;
  };

  const formatTime = (scheduled_at: string) => {
    if (!scheduled_at) return "";
    try {
      return new Date(scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  };

  if (isLoading) return <LoadingScreen message="Loading schedule..." />;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.tenantName}>{tenant?.name || ""}</Text>
          <Text style={s.greeting}>{greeting()}, {firstName}</Text>
        </View>
        <TouchableOpacity onPress={async () => { await clearCrewToken(); router.replace("/"); }} style={s.avatarCircle}>
          <Ionicons name="log-out-outline" size={18} color={Theme.primaryLight} />
        </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={s.toolbar}>
        <TouchableOpacity onPress={() => navigateDate(-1)}>
          <Ionicons name="chevron-back" size={22} color={Theme.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(new Date().toISOString().split("T")[0])}>
          <Text style={s.dateLabel}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigateDate(1)}>
          <Ionicons name="chevron-forward" size={22} color={Theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={s.viewToggle}>
          {(["day", "week"] as ViewMode[]).map((m) => (
            <TouchableOpacity key={m} onPress={() => setViewMode(m)} style={[s.viewBtn, viewMode === m && s.viewBtnActive]}>
              <Text style={[s.viewBtnText, viewMode === m && s.viewBtnTextActive]}>{m === "day" ? "Day" : "Week"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pending Jobs Banner */}
      {pendingJobs.length > 0 && (
        <TouchableOpacity
          style={s.pendingBanner}
          onPress={() => {
            const pj = pendingJobs[0];
            router.push(`/crew/job/${pj.id}?token=${token}` as any);
          }}
        >
          <Ionicons name="alert-circle" size={20} color="#f97316" />
          <Text style={s.pendingText}>{pendingJobs.length} job{pendingJobs.length > 1 ? "s" : ""} need your response</Text>
          <Text style={s.pendingView}>View</Text>
        </TouchableOpacity>
      )}

      {/* Job List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      >
        {jobs.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={Theme.zinc600} />
            <Text style={s.emptyText}>{timeOffDates.has(date) ? "Day off" : "No jobs scheduled"}</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const route = job.job_type === "estimate"
                  ? `/crew/estimate/${job.id}?token=${token}`
                  : `/crew/job/${job.id}?token=${token}`;
                router.push(route as any);
              }}
            >
              <GlassCard>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[s.statusBar, { backgroundColor: statusColor(job) }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.jobRow}>
                      <Text style={s.jobTime}>{formatTime(job.scheduled_at)}</Text>
                      <View style={[s.statusBadge, { backgroundColor: statusBg(job) }]}>
                        <Text style={[s.statusBadgeText, { color: statusColor(job) }]}>
                          {job.assignment_status === "pending" ? "Needs Response" : job.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.jobService}>{job.service_type}</Text>
                    <Text style={s.jobAddress} numberOfLines={1}>{job.address}</Text>
                    <View style={s.jobFooter}>
                      <Text style={s.jobCustomer}>{job.customer_first_name || ""}</Text>
                      <Text style={s.jobHours}>{job.hours}h</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.zinc600} style={{ alignSelf: "center" }} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={s.jobCount}>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</Text>
        {cleaner?.employee_type === "salesman" && (
          <TouchableOpacity style={s.newQuoteFab} onPress={() => router.push(`/crew/new-quote?token=${token}` as any)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.newQuoteFabText}>New Quote</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function statusBg(job: CrewJob) {
  if (job.status === "completed") return Theme.successBg;
  if (job.assignment_status === "pending") return "rgba(249,115,22,0.1)";
  return "rgba(113,113,122,0.1)";
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  tenantName: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  greeting: { fontSize: 22, fontWeight: "700", color: Theme.foreground, marginTop: 2 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: Theme.primaryLight },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  dateLabel: { fontSize: 15, fontWeight: "600", color: Theme.foreground, paddingHorizontal: 8 },
  viewToggle: { flexDirection: "row", borderRadius: 6, backgroundColor: Theme.muted, padding: 2 },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  viewBtnActive: { backgroundColor: Theme.card },
  viewBtnText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  viewBtnTextActive: { color: Theme.primary },
  pendingBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.1)", borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", gap: 8 },
  pendingText: { flex: 1, fontSize: 13, fontWeight: "500", color: "#fb923c" },
  pendingView: { fontSize: 13, fontWeight: "600", color: "#f97316" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: Theme.mutedForeground },
  statusBar: { width: 3, borderRadius: 2, alignSelf: "stretch", minHeight: 40 },
  jobRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jobTime: { fontSize: 14, fontWeight: "600", color: Theme.foreground },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
  jobService: { fontSize: 13, fontWeight: "500", color: Theme.foreground, marginTop: 4 },
  jobAddress: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  jobFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  jobCustomer: { fontSize: 12, color: Theme.mutedForeground },
  jobHours: { fontSize: 12, fontWeight: "600", color: Theme.primaryLight },
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.card },
  jobCount: { fontSize: 13, color: Theme.mutedForeground },
  newQuoteFab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: Theme.primary },
  newQuoteFabText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
