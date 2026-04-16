import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchMyJobs, fetchCrews, fetchTeams, fetchTimeOff, createJob, requestTimeOff, deleteTimeOff } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

type ViewMode = "day" | "week";
type ScheduleTab = "jobs" | "crew" | "timeoff";

const SERVICE_TYPES = ["Standard Clean", "Deep Clean", "Move-In/Out", "Post-Construction", "Window Cleaning", "Carpet Cleaning"];

interface JobForm {
  customer_name: string;
  phone_number: string;
  address: string;
  service_type: string;
  scheduled_date: string;
  scheduled_time: string;
}

const emptyJobForm: JobForm = {
  customer_name: "",
  phone_number: "",
  address: "",
  service_type: "",
  scheduled_date: new Date().toISOString().split("T")[0],
  scheduled_time: "09:00",
};

export default function ScheduleScreen() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [schedTab, setSchedTab] = useState<ScheduleTab>("jobs");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobForm, setJobForm] = useState<JobForm>(emptyJobForm);
  const queryClient = useQueryClient();

  // Get month for time-off query
  const month = date.slice(0, 7);

  // Queries
  const jobsQuery = useQuery({
    queryKey: ["my-jobs", date, viewMode],
    queryFn: () => fetchMyJobs(date, viewMode),
  });
  const crewsQuery = useQuery({
    queryKey: ["crews-schedule", date, viewMode],
    queryFn: () => fetchCrews(date, viewMode === "week"),
  });
  const teamsQuery = useQuery({
    queryKey: ["teams-schedule"],
    queryFn: fetchTeams,
  });
  const timeOffQuery = useQuery({
    queryKey: ["time-off", month],
    queryFn: () => fetchTimeOff(month),
    enabled: schedTab === "timeoff",
  });

  const createJobMutation = useMutation({
    mutationFn: (formData: JobForm) => createJob({
      customer_name: formData.customer_name, phone_number: formData.phone_number,
      address: formData.address, service_type: formData.service_type,
      scheduled_date: formData.scheduled_date, scheduled_time: formData.scheduled_time,
    } as Partial<Job>),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      setShowCreateModal(false);
      setJobForm(emptyJobForm);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const timeOffMutation = useMutation({
    mutationFn: (data: { cleanerId: number; dates: string[]; action: "add" | "remove" }) =>
      data.action === "add"
        ? requestTimeOff(data.cleanerId, data.dates)
        : deleteTimeOff(data.cleanerId, data.dates),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Derived data
  const jobs: Job[] = (jobsQuery.data as any)?.jobs ?? (jobsQuery.data as any)?.data ?? [];
  const dateRange = (jobsQuery.data as any)?.dateRange;
  const crewsRaw: any = crewsQuery.data ?? {};
  const crews: any[] = crewsRaw.data?.crews ?? crewsRaw.data ?? crewsRaw.crews ?? [];
  const teamsRaw: any = teamsQuery.data ?? {};
  const teamsList: any[] = teamsRaw.data?.teams ?? teamsRaw.data ?? teamsRaw.teams ?? [];
  const timeOffRaw: any = timeOffQuery.data ?? {};
  const timeOffEntries: any[] = timeOffRaw.data?.entries ?? timeOffRaw.data ?? timeOffRaw.entries ?? [];

  // Workers from teams
  const allWorkers = useMemo(() => {
    const workers: any[] = [];
    for (const team of teamsList) {
      if (team.members) {
        for (const member of team.members) {
          workers.push({ ...member, teamName: team.name });
        }
      }
    }
    return workers;
  }, [teamsList]);

  // Group jobs by cleaner for crew view
  const jobsByCleaner = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      const key = job.cleaner_name || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [jobs]);

  // Time-off dates set for quick lookup
  const timeOffByWorker = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    for (const entry of timeOffEntries) {
      const id = entry.cleaner_id;
      if (!map[id]) map[id] = new Set();
      if (entry.date) map[id].add(entry.date);
      if (entry.dates) for (const d of entry.dates) map[id].add(d);
    }
    return map;
  }, [timeOffEntries]);

  // Generate month days for time-off calendar
  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${month}-${String(day).padStart(2, "0")}`;
    });
  }, [month]);

  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + (viewMode === "week" ? 7 * dir : dir));
    setDate(d.toISOString().split("T")[0]);
  };

  const goToToday = () => setDate(new Date().toISOString().split("T")[0]);

  const handleCreateJob = () => {
    if (!jobForm.customer_name.trim() || !jobForm.phone_number.trim() || !jobForm.address.trim() || !jobForm.service_type) {
      Alert.alert("Validation", "All fields are required");
      return;
    }
    createJobMutation.mutate(jobForm);
  };

  const statusColor = (s?: string) => {
    switch (s) {
      case "completed": return Theme.success;
      case "in_progress": case "in-progress": return Theme.primary;
      case "confirmed": return Theme.blue400;
      case "cancelled": return Theme.destructive;
      default: return Theme.zinc400;
    }
  };

  if (jobsQuery.isLoading) return <LoadingScreen message="Loading schedule..." />;

  return (
    <View style={st.wrapper}>
      {/* Sub-tabs */}
      <View style={st.schedTabBar}>
        {([
          { key: "jobs" as ScheduleTab, label: "Jobs", icon: "briefcase-outline" as const },
          { key: "crew" as ScheduleTab, label: "Crew", icon: "people-outline" as const },
          { key: "timeoff" as ScheduleTab, label: "Time Off", icon: "calendar-outline" as const },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { setSchedTab(t.key); Haptics.selectionAsync(); }}
            style={[st.schedTab, schedTab === t.key && st.schedTabActive]}
          >
            <Ionicons name={t.icon} size={14} color={schedTab === t.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[st.schedTabText, schedTab === t.key && st.schedTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={st.container}
        refreshControl={<RefreshControl refreshing={jobsQuery.isRefetching} onRefresh={() => { jobsQuery.refetch(); crewsQuery.refetch(); }} tintColor={Theme.primary} />}
      >
        <View style={st.content}>
          {/* View Mode + Date Nav (shared by jobs and crew tabs) */}
          {schedTab !== "timeoff" && (
            <>
              <View style={st.headerRow}>
                <View style={st.viewToggle}>
                  {(["day", "week"] as ViewMode[]).map((mode) => (
                    <TouchableOpacity key={mode} onPress={() => setViewMode(mode)}
                      style={[st.viewBtn, viewMode === mode && st.viewBtnActive]}>
                      <Text style={[st.viewBtnText, viewMode === mode && st.viewBtnTextActive]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={goToToday} style={st.todayBtn}>
                  <Text style={st.todayBtnText}>Today</Text>
                </TouchableOpacity>
              </View>

              <View style={st.dateNav}>
                <TouchableOpacity onPress={() => navigateDate(-1)}>
                  <Ionicons name="chevron-back" size={24} color={Theme.primary} />
                </TouchableOpacity>
                <Text style={st.dateLabel}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {dateRange?.end && ` — ${new Date(dateRange.end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </Text>
                <TouchableOpacity onPress={() => navigateDate(1)}>
                  <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ═══ JOBS TAB ═══ */}
          {schedTab === "jobs" && (
            <>
              {jobs.length === 0 ? (
                <EmptyState icon="calendar-outline" title="No jobs scheduled" description="No jobs for this period" />
              ) : (
                jobs.map((job, i) => (
                  <GlassCard key={job.id || i} style={st.card}>
                    <View style={st.jobRow}>
                      <View style={[st.statusDot, { backgroundColor: statusColor(job.status) }]} />
                      <View style={{ flex: 1 }}>
                        <View style={st.rowBetween}>
                          <Text style={st.nameText}>{job.customer_name || job.phone_number || "Job"}</Text>
                          <Badge label={job.status || "scheduled"} variant={job.status === "completed" ? "success" : "default"} />
                        </View>
                        <Text style={st.subText}>
                          {[job.scheduled_time, job.service_type].filter(Boolean).join(" • ")}
                        </Text>
                        {job.address && <Text style={st.addressText} numberOfLines={1}>{job.address}</Text>}
                        {job.cleaner_name && (
                          <View style={st.cleanerBadge}>
                            <Ionicons name="person-outline" size={10} color={Theme.primaryLight} />
                            <Text style={st.cleanerName}>{job.cleaner_name}</Text>
                          </View>
                        )}
                      </View>
                      {job.price != null && <Text style={st.priceText}>${job.price}</Text>}
                    </View>
                  </GlassCard>
                ))
              )}
            </>
          )}

          {/* ═══ CREW TAB ═══ */}
          {schedTab === "crew" && (
            <>
              {Object.entries(jobsByCleaner).length === 0 ? (
                <EmptyState icon="people-outline" title="No crew assignments" />
              ) : (
                Object.entries(jobsByCleaner).map(([cleaner, cleanerJobs]) => (
                  <GlassCard key={cleaner} style={st.card}>
                    <View style={st.rowBetween}>
                      <View style={st.crewHeader}>
                        <View style={st.crewAvatar}>
                          <Text style={st.crewAvatarText}>{cleaner[0]?.toUpperCase() || "?"}</Text>
                        </View>
                        <View>
                          <Text style={st.nameText}>{cleaner}</Text>
                          <Text style={st.subText}>{cleanerJobs.length} job{cleanerJobs.length !== 1 ? "s" : ""}</Text>
                        </View>
                      </View>
                      <Text style={st.crewRevenue}>
                        ${cleanerJobs.reduce((sum, j) => sum + (j.price ?? 0), 0)}
                      </Text>
                    </View>
                    {cleanerJobs.map((job, i) => (
                      <View key={job.id || i} style={st.crewJobItem}>
                        <View style={[st.statusDot, { backgroundColor: statusColor(job.status) }]} />
                        <Text style={st.crewJobTime}>{job.scheduled_time || "TBD"}</Text>
                        <Text style={st.crewJobName} numberOfLines={1}>{job.customer_name || "Job"}</Text>
                        <Text style={st.crewJobType}>{job.service_type || ""}</Text>
                      </View>
                    ))}
                  </GlassCard>
                ))
              )}

              {/* Available workers without jobs */}
              {allWorkers.filter((w) => !jobsByCleaner[w.name]).length > 0 && (
                <GlassCard>
                  <Text style={st.sectionTitle}>Available</Text>
                  {allWorkers.filter((w) => !jobsByCleaner[w.name]).map((w, i) => (
                    <View key={w.id || i} style={st.availableWorker}>
                      <Ionicons name="person-outline" size={14} color={Theme.success} />
                      <Text style={st.availableName}>{w.name}</Text>
                      <Text style={st.availableTeam}>{w.teamName}</Text>
                      <View style={[st.roleBadge, { backgroundColor: w.role === "lead" ? Theme.primaryMuted : w.role === "salesman" ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)" }]}>
                        <Text style={[st.roleBadgeText, { color: w.role === "lead" ? Theme.primaryLight : w.role === "salesman" ? Theme.amber400 : Theme.zinc400 }]}>
                          {w.role === "lead" ? "TL" : w.role === "salesman" ? "S" : "T"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              )}
            </>
          )}

          {/* ═══ TIME OFF TAB ═══ */}
          {schedTab === "timeoff" && (
            <>
              <Text style={st.sectionTitle}>Time Off — {new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Text>
              <View style={st.monthNav}>
                <TouchableOpacity onPress={() => {
                  const [y, m] = month.split("-").map(Number);
                  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                  setDate(prev + "-01");
                }}>
                  <Ionicons name="chevron-back" size={20} color={Theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const [y, m] = month.split("-").map(Number);
                  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                  setDate(next + "-01");
                }}>
                  <Ionicons name="chevron-forward" size={20} color={Theme.primary} />
                </TouchableOpacity>
              </View>

              {allWorkers.length === 0 ? (
                <EmptyState icon="calendar-outline" title="No team members" />
              ) : (
                allWorkers.map((worker) => {
                  const workerTimeOff = timeOffByWorker[Number(worker.id)] ?? new Set();
                  return (
                    <GlassCard key={worker.id} style={st.card}>
                      <Text style={st.nameText}>{worker.name}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        <View style={st.dayRow}>
                          {monthDays.map((day) => {
                            const dayNum = parseInt(day.split("-")[2]);
                            const isOff = workerTimeOff.has(day);
                            return (
                              <TouchableOpacity
                                key={day}
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  timeOffMutation.mutate({
                                    cleanerId: Number(worker.id),
                                    dates: [day],
                                    action: isOff ? "remove" : "add",
                                  });
                                }}
                                style={[st.dayCell, isOff && st.dayCellOff]}
                              >
                                <Text style={[st.dayNum, isOff && st.dayNumOff]}>{dayNum}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </GlassCard>
                  );
                })
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      {schedTab === "jobs" && (
        <TouchableOpacity style={st.fab} onPress={() => { setJobForm({ ...emptyJobForm, scheduled_date: date }); setShowCreateModal(true); }} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create Job Modal */}
      <Modal visible={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Job">
        <InputField label="Customer Name" value={jobForm.customer_name} onChangeText={(v: string) => setJobForm((f) => ({ ...f, customer_name: v }))} placeholder="Full name" />
        <InputField label="Phone Number" value={jobForm.phone_number} onChangeText={(v: string) => setJobForm((f) => ({ ...f, phone_number: v }))} placeholder="(555) 123-4567" keyboardType="phone-pad" />
        <InputField label="Address" value={jobForm.address} onChangeText={(v: string) => setJobForm((f) => ({ ...f, address: v }))} placeholder="Street address" />
        <Text style={st.fieldLabel}>Service Type</Text>
        <View style={st.serviceGrid}>
          {SERVICE_TYPES.map((type) => (
            <TouchableOpacity key={type} onPress={() => setJobForm((f) => ({ ...f, service_type: type }))}
              style={[st.serviceChip, jobForm.service_type === type && st.serviceChipActive]}>
              <Text style={[st.serviceChipText, jobForm.service_type === type && st.serviceChipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <InputField label="Date" value={jobForm.scheduled_date} onChangeText={(v: string) => setJobForm((f) => ({ ...f, scheduled_date: v }))} placeholder="YYYY-MM-DD" />
        <InputField label="Time" value={jobForm.scheduled_time} onChangeText={(v: string) => setJobForm((f) => ({ ...f, scheduled_time: v }))} placeholder="HH:MM" />
        <View style={{ marginTop: 16 }}>
          <ActionButton title="Create Job" onPress={handleCreateJob} variant="primary" loading={createJobMutation.isPending} />
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Theme.background },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },

  // Schedule sub-tabs
  schedTabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  schedTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 },
  schedTabActive: { borderBottomWidth: 2, borderBottomColor: Theme.primary },
  schedTabText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  schedTabTextActive: { color: Theme.primary },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  viewToggle: { flexDirection: "row", borderRadius: 8, backgroundColor: Theme.muted, padding: 3 },
  viewBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  viewBtnActive: { backgroundColor: Theme.card },
  viewBtnText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  viewBtnTextActive: { color: Theme.primary },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Theme.primaryMuted },
  todayBtnText: { fontSize: 12, fontWeight: "600", color: Theme.primaryLight },

  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  dateLabel: { fontSize: 16, fontWeight: "600", color: Theme.foreground },

  card: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },

  // Jobs
  jobRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nameText: { fontWeight: "500", color: Theme.foreground },
  subText: { fontSize: 13, color: Theme.mutedForeground, marginTop: 2 },
  addressText: { fontSize: 11, color: Theme.zinc400, marginTop: 2 },
  priceText: { fontSize: 14, fontWeight: "600", color: Theme.success },
  cleanerBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Theme.primaryMuted, alignSelf: "flex-start" },
  cleanerName: { fontSize: 11, color: Theme.primaryLight, fontWeight: "500" },

  // Crew view
  crewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  crewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  crewAvatarText: { fontSize: 14, fontWeight: "700", color: Theme.primaryLight },
  crewRevenue: { fontSize: 14, fontWeight: "700", color: Theme.success },
  crewJobItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" },
  crewJobTime: { fontSize: 12, fontWeight: "600", color: Theme.mutedForeground, width: 48 },
  crewJobName: { flex: 1, fontSize: 13, color: Theme.foreground },
  crewJobType: { fontSize: 11, color: Theme.zinc400 },

  // Available workers
  availableWorker: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  availableName: { flex: 1, fontSize: 13, color: Theme.foreground },
  availableTeam: { fontSize: 11, color: Theme.mutedForeground },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleBadgeText: { fontSize: 10, fontWeight: "700" },

  // Time-off calendar
  monthNav: { flexDirection: "row", gap: 12, marginBottom: 12 },
  dayRow: { flexDirection: "row", gap: 4 },
  dayCell: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.04)" },
  dayCellOff: { backgroundColor: Theme.destructiveBg, borderWidth: 1, borderColor: Theme.destructive + "40" },
  dayNum: { fontSize: 11, color: Theme.foreground },
  dayNumOff: { color: Theme.destructive, fontWeight: "600" },

  // FAB
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Theme.primary, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: Theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground, marginBottom: 6 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  serviceChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted },
  serviceChipActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.1)" },
  serviceChipText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  serviceChipTextActive: { color: Theme.primary },
});
