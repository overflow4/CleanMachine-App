import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Linking,
  Modal as RNModal, Switch, TextInput, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCrewDashboard, toggleTimeOff, saveAvailability, CrewJob } from "@/lib/crew-api";
import { getCrewToken, setCrewToken, clearCrewToken } from "@/lib/crew-store";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

type ViewMode = "day" | "week";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeeklySchedule = Record<string, DaySchedule>;

const DEFAULT_WEEKLY: WeeklySchedule = Object.fromEntries(
  DAYS_OF_WEEK.map((day) => [
    day.toLowerCase(),
    { enabled: true, start: "9:00 AM", end: "5:00 PM" },
  ])
);

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

  // Availability modal state
  const [availModalVisible, setAvailModalVisible] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({ ...DEFAULT_WEEKLY });
  const [availTab, setAvailTab] = useState<"weekly" | "timeoff">("weekly");
  const [timeOffMonth, setTimeOffMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

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

  // Sync availability from server data
  useEffect(() => {
    if (data?.cleaner?.availability) {
      try {
        const avail = typeof data.cleaner.availability === "string"
          ? JSON.parse(data.cleaner.availability)
          : data.cleaner.availability;
        if (avail.weekly) {
          setWeeklySchedule((prev) => ({ ...prev, ...avail.weekly }));
        }
      } catch {}
    }
  }, [data?.cleaner?.availability]);

  // Mutations
  const saveAvailMutation = useMutation({
    mutationFn: (schedule: WeeklySchedule) => saveAvailability(token!, schedule),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["crew-dashboard"] });
      Alert.alert("Saved", "Weekly availability updated.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const timeOffMutation = useMutation({
    mutationFn: (dateStr: string) => toggleTimeOff(token!, dateStr),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["crew-dashboard"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

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

  // Calendar grid for time-off
  const calendarGrid = useMemo(() => {
    const { year, month } = timeOffMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(firstDay).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [timeOffMonth]);

  const formatDateStr = (day: number) => {
    const { year, month } = timeOffMonth;
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const navigateMonth = (dir: number) => {
    setTimeOffMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
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
        <TouchableOpacity
          style={s.availabilityBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAvailModalVisible(true);
          }}
        >
          <Ionicons name="time-outline" size={16} color={Theme.primary} />
          <Text style={s.availabilityBtnText}>Availability</Text>
        </TouchableOpacity>
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

      {/* Availability Modal */}
      <RNModal
        visible={availModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAvailModalVisible(false)}
      >
        <View style={[s.modalContainer, { paddingTop: insets.top + 8 }]}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Availability</Text>
            <TouchableOpacity onPress={() => setAvailModalVisible(false)} style={s.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Theme.foreground} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, availTab === "weekly" && s.tabActive]}
              onPress={() => setAvailTab("weekly")}
            >
              <Text style={[s.tabText, availTab === "weekly" && s.tabTextActive]}>Weekly Hours</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, availTab === "timeoff" && s.tabActive]}
              onPress={() => setAvailTab("timeoff")}
            >
              <Text style={[s.tabText, availTab === "timeoff" && s.tabTextActive]}>Time Off</Text>
            </TouchableOpacity>
          </View>

          {availTab === "weekly" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
              {DAYS_OF_WEEK.map((day) => {
                const key = day.toLowerCase();
                const sched = weeklySchedule[key] || { enabled: true, start: "9:00 AM", end: "5:00 PM" };
                return (
                  <View key={day} style={s.dayRow}>
                    <View style={s.dayLabelRow}>
                      <Switch
                        value={sched.enabled}
                        onValueChange={(v) => updateDaySchedule(key, "enabled", v)}
                        trackColor={{ false: Theme.muted, true: Theme.primaryMuted }}
                        thumbColor={sched.enabled ? Theme.primary : Theme.zinc600}
                      />
                      <Text style={[s.dayLabel, !sched.enabled && s.dayLabelOff]}>{day}</Text>
                    </View>
                    {sched.enabled && (
                      <View style={s.timeRow}>
                        <TextInput
                          style={s.timeInput}
                          value={sched.start}
                          onChangeText={(v) => updateDaySchedule(key, "start", v)}
                          placeholder="9:00 AM"
                          placeholderTextColor={Theme.zinc600}
                        />
                        <Text style={s.timeSep}>to</Text>
                        <TextInput
                          style={s.timeInput}
                          value={sched.end}
                          onChangeText={(v) => updateDaySchedule(key, "end", v)}
                          placeholder="5:00 PM"
                          placeholderTextColor={Theme.zinc600}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity
                style={s.saveBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  saveAvailMutation.mutate(weeklySchedule);
                }}
                disabled={saveAvailMutation.isPending}
              >
                <Text style={s.saveBtnText}>
                  {saveAvailMutation.isPending ? "Saving..." : "Save Availability"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={{ flex: 1, padding: 16 }}>
              {/* Month Navigation */}
              <View style={s.monthNav}>
                <TouchableOpacity onPress={() => navigateMonth(-1)}>
                  <Ionicons name="chevron-back" size={22} color={Theme.foreground} />
                </TouchableOpacity>
                <Text style={s.monthLabel}>
                  {new Date(timeOffMonth.year, timeOffMonth.month).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity onPress={() => navigateMonth(1)}>
                  <Ionicons name="chevron-forward" size={22} color={Theme.foreground} />
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View style={s.calWeekRow}>
                {DAYS_SHORT.map((d) => (
                  <View key={d} style={s.calDayHeader}>
                    <Text style={s.calDayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              {calendarGrid.map((week, wi) => (
                <View key={wi} style={s.calWeekRow}>
                  {week.map((day, di) => {
                    if (day === null) {
                      return <View key={di} style={s.calDayCell} />;
                    }
                    const dateStr = formatDateStr(day);
                    const isOff = timeOffDates.has(dateStr);
                    const isToday = dateStr === new Date().toISOString().split("T")[0];
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          s.calDayCell,
                          isOff && s.calDayCellOff,
                          isToday && !isOff && s.calDayCellToday,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          timeOffMutation.mutate(dateStr);
                        }}
                        disabled={timeOffMutation.isPending}
                      >
                        <Text
                          style={[
                            s.calDayText,
                            isOff && s.calDayTextOff,
                            isToday && !isOff && s.calDayTextToday,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={s.legendText}>Day off</Text>
                <View style={{ width: 16 }} />
                <View style={[s.legendDot, { backgroundColor: Theme.card }]} />
                <Text style={s.legendText}>Work day</Text>
              </View>
              <Text style={s.legendHint}>Tap a day to toggle time off</Text>
            </View>
          )}
        </View>
      </RNModal>
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
  availabilityBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Theme.primaryMuted },
  availabilityBtnText: { fontSize: 12, fontWeight: "600", color: Theme.primary },
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

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: Theme.background },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: Theme.foreground },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.muted, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: 8, backgroundColor: Theme.muted, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  tabActive: { backgroundColor: Theme.card },
  tabText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary, fontWeight: "600" },

  // Weekly hours
  dayRow: { backgroundColor: Theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Theme.border },
  dayLabelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayLabel: { fontSize: 15, fontWeight: "600", color: Theme.foreground },
  dayLabelOff: { color: Theme.mutedForeground },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  timeInput: { flex: 1, backgroundColor: Theme.muted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Theme.foreground, borderWidth: 1, borderColor: Theme.border },
  timeSep: { fontSize: 13, color: Theme.mutedForeground },
  saveBtn: { backgroundColor: Theme.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Time off calendar
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthLabel: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  calWeekRow: { flexDirection: "row" },
  calDayHeader: { flex: 1, alignItems: "center", paddingVertical: 6 },
  calDayHeaderText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  calDayCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, margin: 2, borderRadius: 8, backgroundColor: Theme.card },
  calDayCellOff: { backgroundColor: "#ef4444" },
  calDayCellToday: { borderWidth: 2, borderColor: Theme.primary },
  calDayText: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  calDayTextOff: { color: "#fff", fontWeight: "700" },
  calDayTextToday: { color: Theme.primary, fontWeight: "700" },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 20, gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: Theme.mutedForeground },
  legendHint: { fontSize: 12, color: Theme.zinc600, textAlign: "center", marginTop: 8 },
});
