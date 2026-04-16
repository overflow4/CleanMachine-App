import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchCrews, fetchTeams, saveCrews, fetchJobs, fetchTimeOff, requestTimeOff, deleteTimeOff } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Cleaner, CrewDay, CrewAssignment, Job } from "@/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

type ViewMode = "day" | "week";

const ROLE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  TL: { label: "TL", color: Theme.primary, bg: Theme.primaryMuted },
  T: { label: "T", color: Theme.emerald400, bg: Theme.successBg },
  S: { label: "S", color: Theme.amber400, bg: Theme.warningBg },
  lead: { label: "TL", color: Theme.primary, bg: Theme.primaryMuted },
  technician: { label: "T", color: Theme.emerald400, bg: Theme.successBg },
  salesman: { label: "S", color: Theme.amber400, bg: Theme.warningBg },
};

const STATUS_COLORS: Record<string, string> = {
  completed: Theme.success,
  in_progress: Theme.primary,
  "in-progress": Theme.primary,
  scheduled: Theme.zinc500,
  assigned: Theme.violet400,
  confirmed: Theme.emerald400,
  cancelled: Theme.destructive,
};

function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(start.getDate() - day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    dates.push(dt.toISOString().split("T")[0]);
  }
  return dates;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function getRoleBadge(role?: string): { label: string; color: string; bg: string } {
  if (!role) return ROLE_BADGES.T;
  const key = role.toLowerCase();
  if (key.includes("lead") || key === "tl") return ROLE_BADGES.TL;
  if (key.includes("sales") || key === "s") return ROLE_BADGES.S;
  return ROLE_BADGES.T;
}

export default function CrewsScreen() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [dirtyDays, setDirtyDays] = useState<Set<string>>(new Set());
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [timeOffModalVisible, setTimeOffModalVisible] = useState(false);
  const [selectedCleanerForTimeOff, setSelectedCleanerForTimeOff] = useState<Cleaner | null>(null);
  const [timeOffReason, setTimeOffReason] = useState("");
  const queryClient = useQueryClient();

  const weekDates = useMemo(() => getWeekDates(date), [date]);
  const today = new Date().toISOString().split("T")[0];

  // Queries
  const crewsQuery = useQuery({
    queryKey: ["crews", date],
    queryFn: () => fetchCrews(date),
  });

  const crewsWeekQuery = useQuery({
    queryKey: ["crews-week", weekDates[0]],
    queryFn: () => fetchCrews(weekDates[0], true),
    enabled: viewMode === "week",
  });

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", date],
    queryFn: () => fetchJobs({ date }),
  });

  const jobsWeekQuery = useQuery({
    queryKey: ["jobs-week", weekDates[0], weekDates[6]],
    queryFn: () => fetchJobs({ start_date: weekDates[0], end_date: weekDates[6] }),
    enabled: viewMode === "week",
  });

  const monthStr = date.slice(0, 7);
  const timeOffQuery = useQuery({
    queryKey: ["time-off", monthStr],
    queryFn: () => fetchTimeOff(monthStr),
  });

  // Data extraction
  const crewDays: CrewDay[] = (crewsQuery.data as any)?.crewDays ?? (crewsQuery.data as any)?.data ?? [];
  const weekCrewDays: CrewDay[] = (crewsWeekQuery.data as any)?.crewDays ?? (crewsWeekQuery.data as any)?.data ?? [];
  const cleaners: Cleaner[] =
    (teamsQuery.data as any)?.data?.cleaners ??
    (teamsQuery.data as any)?.cleaners ??
    (teamsQuery.data as any)?.data ??
    [];
  const dayJobs: Job[] = (jobsQuery.data as any)?.data ?? (jobsQuery.data as any)?.jobs ?? [];
  const weekJobs: Job[] = (jobsWeekQuery.data as any)?.data ?? (jobsWeekQuery.data as any)?.jobs ?? [];

  const timeOffDates: Record<string, string[]> = useMemo(() => {
    const entries = (timeOffQuery.data as any)?.data ?? (timeOffQuery.data as any)?.time_off ?? [];
    const map: Record<string, string[]> = {};
    if (Array.isArray(entries)) {
      entries.forEach((entry: any) => {
        const cid = String(entry.cleaner_id);
        if (!map[cid]) map[cid] = [];
        if (Array.isArray(entry.dates)) {
          map[cid].push(...entry.dates);
        } else if (entry.date) {
          map[cid].push(entry.date);
        }
      });
    }
    return map;
  }, [timeOffQuery.data]);

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const source = viewMode === "week" ? weekJobs : dayJobs;
    const map: Record<string, Job[]> = {};
    source.forEach((job) => {
      const d = job.date || job.scheduled_date || "";
      if (!map[d]) map[d] = [];
      map[d].push(job);
    });
    return map;
  }, [viewMode, weekJobs, dayJobs]);

  // Group crew days by date
  const crewsByDate = useMemo(() => {
    const source = viewMode === "week" ? weekCrewDays : crewDays;
    const map: Record<string, CrewDay> = {};
    source.forEach((cd) => {
      map[cd.date] = cd;
    });
    return map;
  }, [viewMode, weekCrewDays, crewDays]);

  // Revenue calculations
  const getDayRevenue = useCallback((dateStr: string): number => {
    const dJobs = jobsByDate[dateStr] || [];
    return dJobs.reduce((sum, j) => sum + (j.price || j.estimated_value || 0), 0);
  }, [jobsByDate]);

  const weeklyRevenue = useMemo(() => {
    return weekDates.reduce((sum, d) => sum + getDayRevenue(d), 0);
  }, [weekDates, getDayRevenue]);

  // Navigation
  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    setDate(d.toISOString().split("T")[0]);
  };

  const goToToday = () => {
    setDate(new Date().toISOString().split("T")[0]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Save mutations
  const saveMutation = useMutation({
    mutationFn: (data: { date: string; assignments: CrewAssignment[] }) =>
      saveCrews(data),
    onMutate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    onSuccess: (_: any, variables: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["crews"] });
      queryClient.invalidateQueries({ queryKey: ["crews-week"] });
      setDirtyDays((prev) => {
        const next = new Set(prev);
        next.delete(variables.date);
        return next;
      });
      setSavingDay(null);
      Alert.alert("Success", "Crews saved");
    },
    onError: (err: Error) => {
      setSavingDay(null);
      Alert.alert("Error", err.message);
    },
  });

  const timeOffMutation = useMutation({
    mutationFn: (data: { cleanerId: number; dates: string[]; reason?: string }) =>
      requestTimeOff(data.cleanerId, data.dates, data.reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      setTimeOffModalVisible(false);
      setSelectedCleanerForTimeOff(null);
      setTimeOffReason("");
      Alert.alert("Success", "Time off marked");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const removeTimeOffMutation = useMutation({
    mutationFn: (data: { cleanerId: number; dates: string[] }) =>
      deleteTimeOff(data.cleanerId, data.dates),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleSaveDay = (dateStr: string) => {
    const cd = crewsByDate[dateStr];
    if (!cd) return;
    setSavingDay(dateStr);
    saveMutation.mutate({ date: dateStr, assignments: cd.assignments });
  };

  const handleToggleTimeOff = (cleaner: Cleaner, dateStr: string) => {
    const cid = String(cleaner.id);
    const isOff = (timeOffDates[cid] || []).includes(dateStr);
    if (isOff) {
      removeTimeOffMutation.mutate({
        cleanerId: Number(cleaner.id),
        dates: [dateStr],
      });
    } else {
      setSelectedCleanerForTimeOff(cleaner);
      setTimeOffReason("");
      setTimeOffModalVisible(true);
    }
  };

  const handleTimeOffSubmit = () => {
    if (!selectedCleanerForTimeOff) return;
    timeOffMutation.mutate({
      cleanerId: Number(selectedCleanerForTimeOff.id),
      dates: [date],
      reason: timeOffReason || undefined,
    });
  };

  const isCleanerOff = (cleanerId: string, dateStr: string): boolean => {
    return (timeOffDates[cleanerId] || []).includes(dateStr);
  };

  // --- Render helpers ---

  const RoleBadgeView = ({ role }: { role?: string }) => {
    const badge = getRoleBadge(role);
    return (
      <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    );
  };

  const JobTimeBlock = ({ job }: { job: Job }) => {
    const statusColor = STATUS_COLORS[job.status || "scheduled"] || Theme.zinc500;
    return (
      <View style={[styles.jobBlock, { borderLeftColor: statusColor }]}>
        <Text style={styles.jobBlockName} numberOfLines={1}>
          {job.customer_name || job.phone_number || "Unnamed"}
        </Text>
        <Text style={styles.jobBlockTime}>
          {job.scheduled_time || job.scheduled_at || "TBD"}
        </Text>
        {job.price != null && (
          <Text style={styles.jobBlockPrice}>${job.price}</Text>
        )}
      </View>
    );
  };

  // --- View Mode Tabs ---
  const ViewModeTabs = () => (
    <View style={styles.viewModeTabs}>
      {(["day", "week"] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewModeTab, viewMode === mode && styles.viewModeTabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode(mode);
          }}
        >
          <Text style={[styles.viewModeTabText, viewMode === mode && styles.viewModeTabTextActive]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
        <Ionicons name="today-outline" size={16} color={Theme.primary} />
        <Text style={styles.todayBtnText}>Today</Text>
      </TouchableOpacity>
    </View>
  );

  // --- Day View ---
  const renderDayView = () => {
    const dayRevenue = getDayRevenue(date);

    return (
      <View style={styles.content}>
        {/* Date Nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateDate(-1)}>
            <Ionicons name="chevron-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <View style={styles.dateNavCenter}>
            <Text style={styles.dateLabel}>
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            {date === today && (
              <View style={styles.todayIndicator}>
                <Text style={styles.todayIndicatorText}>Today</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => navigateDate(1)}>
            <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Revenue summary */}
        <GlassCard style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.revenueLabel}>Daily Revenue</Text>
              <Text style={styles.revenueValue}>${dayRevenue.toFixed(2)}</Text>
            </View>
            <View>
              <Text style={styles.revenueLabel}>Jobs</Text>
              <Text style={styles.revenueValue}>{dayJobs.length}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Available Cleaners */}
        <Text style={styles.sectionLabel}>Available Cleaners</Text>
        {cleaners.length === 0 ? (
          <GlassCard style={styles.cardSpacing}>
            <Text style={styles.emptyText}>No cleaners available</Text>
          </GlassCard>
        ) : (
          <View style={styles.cleanerChips}>
            {cleaners
              .filter((c) => c.active)
              .map((cleaner, i) => {
                const cid = String(cleaner.id);
                const isOff = isCleanerOff(cid, date);
                return (
                  <TouchableOpacity
                    key={cleaner.id || i}
                    style={[styles.cleanerChip, isOff && styles.cleanerChipOff]}
                    onPress={() => handleToggleTimeOff(cleaner, date)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cleanerChipHeader}>
                      <Text
                        style={[
                          styles.cleanerChipName,
                          isOff && styles.cleanerChipNameOff,
                        ]}
                      >
                        {cleaner.name}
                      </Text>
                      <RoleBadgeView
                        role={
                          cleaner.is_team_lead
                            ? "lead"
                            : cleaner.employee_type || "technician"
                        }
                      />
                    </View>
                    {isOff ? (
                      <Text style={styles.cleanerChipOffText}>Time Off</Text>
                    ) : (
                      <Text style={styles.cleanerChipRole}>Available</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* Crew Assignments */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Crew Assignments</Text>
          {dirtyDays.has(date) && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSaveDay(date)}
              disabled={savingDay === date}
            >
              {savingDay === date ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={14} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {crewDays.length === 0 ? (
          <EmptyState
            icon="construct-outline"
            title="No crews assigned"
            description="Assign crews for this day"
          />
        ) : (
          crewDays.map((day, i) =>
            day.assignments.map((assignment, j) => (
              <GlassCard key={`${i}-${j}`} style={styles.cardSpacing}>
                <View style={styles.row}>
                  <Ionicons name="people" size={20} color={Theme.primaryLight} />
                  <Text style={styles.leadName}>
                    {assignment.team_lead_name ||
                      `Team Lead #${assignment.team_lead_id}`}
                  </Text>
                  <RoleBadgeView role="lead" />
                </View>
                {assignment.members.map((member, k) => {
                  const memberOff = isCleanerOff(
                    String(member.cleaner_id),
                    date
                  );
                  return (
                    <View
                      key={k}
                      style={[
                        styles.memberRow,
                        memberOff && styles.memberRowOff,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={
                          memberOff
                            ? Theme.destructive
                            : Theme.mutedForeground
                        }
                      />
                      <Text
                        style={[
                          styles.memberName,
                          memberOff && styles.memberNameOff,
                        ]}
                      >
                        {member.name || `Cleaner #${member.cleaner_id}`}
                      </Text>
                      <RoleBadgeView role={member.role} />
                      {memberOff && (
                        <Text style={styles.memberOffLabel}>OFF</Text>
                      )}
                    </View>
                  );
                })}

                {/* Jobs for this team lead */}
                {dayJobs
                  .filter(
                    (j) =>
                      j.team_id &&
                      String(j.team_id) === String(assignment.team_lead_id)
                  )
                  .map((job) => (
                    <JobTimeBlock key={job.id} job={job} />
                  ))}
              </GlassCard>
            ))
          )
        )}

        {/* Unassigned jobs */}
        {dayJobs.filter((j) => !j.team_id && !j.cleaner_id).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Unassigned Jobs</Text>
            {dayJobs
              .filter((j) => !j.team_id && !j.cleaner_id)
              .map((job) => (
                <GlassCard key={job.id} style={styles.cardSpacing}>
                  <JobTimeBlock job={job} />
                </GlassCard>
              ))}
          </>
        )}
      </View>
    );
  };

  // --- Week View ---
  const renderWeekView = () => {
    const colWidth = (SCREEN_WIDTH - 32) / 7;
    const activeCleaners = cleaners.filter((c) => c.active);

    return (
      <View style={styles.content}>
        {/* Week Nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateWeek(-1)}>
            <Ionicons name="chevron-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>
            {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
          </Text>
          <TouchableOpacity onPress={() => navigateWeek(1)}>
            <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Weekly revenue */}
        <GlassCard style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.revenueLabel}>Weekly Revenue</Text>
              <Text style={styles.revenueValue}>${weeklyRevenue.toFixed(2)}</Text>
            </View>
            <View>
              <Text style={styles.revenueLabel}>Total Jobs</Text>
              <Text style={styles.revenueValue}>
                {weekDates.reduce(
                  (sum, d) => sum + (jobsByDate[d]?.length || 0),
                  0
                )}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Week grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Day headers */}
            <View style={styles.weekHeaderRow}>
              {weekDates.map((d) => {
                const rev = getDayRevenue(d);
                const isToday = d === today;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.weekDayHeader,
                      { width: colWidth },
                      isToday && styles.weekDayHeaderToday,
                    ]}
                    onPress={() => {
                      setDate(d);
                      setViewMode("day");
                    }}
                  >
                    <Text style={styles.weekDayName}>
                      {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.weekDayNum,
                        isToday && styles.weekDayNumToday,
                      ]}
                    >
                      {new Date(d + "T12:00:00").getDate()}
                    </Text>
                    <Text style={styles.weekDayRevenue}>
                      ${rev > 0 ? rev.toFixed(0) : "0"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Per-team rows */}
            {activeCleaners
              .filter((c) => c.is_team_lead)
              .map((lead) => (
                <View key={String(lead.id)} style={styles.weekTeamRow}>
                  {/* Team label */}
                  <View style={styles.weekTeamLabel}>
                    <Text style={styles.weekTeamLabelText} numberOfLines={1}>
                      {lead.name}
                    </Text>
                    <RoleBadgeView role="lead" />
                  </View>
                  {/* Day columns */}
                  <View style={styles.weekTeamColumns}>
                    {weekDates.map((d) => {
                      const dJobs = (jobsByDate[d] || []).filter(
                        (j) =>
                          j.team_id &&
                          String(j.team_id) === String(lead.id)
                      );
                      const leadOff = isCleanerOff(String(lead.id), d);
                      return (
                        <View
                          key={d}
                          style={[
                            styles.weekDayCell,
                            { width: colWidth },
                            leadOff && styles.weekDayCellOff,
                          ]}
                        >
                          {leadOff && (
                            <Text style={styles.weekCellOffText}>OFF</Text>
                          )}
                          {dJobs.length === 0 && !leadOff && (
                            <Text style={styles.weekCellEmpty}>--</Text>
                          )}
                          {dJobs.map((job) => {
                            const sc =
                              STATUS_COLORS[job.status || "scheduled"] ||
                              Theme.zinc500;
                            return (
                              <View
                                key={job.id}
                                style={[
                                  styles.weekJobBlock,
                                  { backgroundColor: sc + "22", borderLeftColor: sc },
                                ]}
                              >
                                <Text
                                  style={styles.weekJobBlockText}
                                  numberOfLines={1}
                                >
                                  {job.scheduled_time || "TBD"}
                                </Text>
                                <Text
                                  style={styles.weekJobBlockName}
                                  numberOfLines={1}
                                >
                                  {job.customer_name || "Job"}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

            {/* Unassigned row */}
            <View style={styles.weekTeamRow}>
              <View style={styles.weekTeamLabel}>
                <Text style={[styles.weekTeamLabelText, { color: Theme.zinc400 }]}>
                  Unassigned
                </Text>
              </View>
              <View style={styles.weekTeamColumns}>
                {weekDates.map((d) => {
                  const dJobs = (jobsByDate[d] || []).filter(
                    (j) => !j.team_id && !j.cleaner_id
                  );
                  return (
                    <View
                      key={d}
                      style={[styles.weekDayCell, { width: colWidth }]}
                    >
                      {dJobs.length === 0 ? (
                        <Text style={styles.weekCellEmpty}>--</Text>
                      ) : (
                        dJobs.map((job) => (
                          <View
                            key={job.id}
                            style={[
                              styles.weekJobBlock,
                              {
                                backgroundColor: Theme.warningBg,
                                borderLeftColor: Theme.warning,
                              },
                            ]}
                          >
                            <Text
                              style={styles.weekJobBlockText}
                              numberOfLines={1}
                            >
                              {job.scheduled_time || "TBD"}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Daily revenue row */}
            <View style={styles.weekRevenueRow}>
              {weekDates.map((d) => {
                const rev = getDayRevenue(d);
                return (
                  <View
                    key={d}
                    style={[styles.weekRevenueCell, { width: colWidth }]}
                  >
                    <Text style={styles.weekRevenueCellText}>
                      ${rev > 0 ? rev.toFixed(0) : "0"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {crewsWeekQuery.isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={Theme.primary} />
          </View>
        )}
      </View>
    );
  };

  if (crewsQuery.isLoading && viewMode === "day")
    return <LoadingScreen message="Loading crews..." />;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={crewsQuery.isRefetching}
            onRefresh={() => {
              crewsQuery.refetch();
              teamsQuery.refetch();
              jobsQuery.refetch();
              timeOffQuery.refetch();
              if (viewMode === "week") {
                crewsWeekQuery.refetch();
                jobsWeekQuery.refetch();
              }
            }}
            tintColor={Theme.primary}
          />
        }
      >
        <ViewModeTabs />
        {viewMode === "day" ? renderDayView() : renderWeekView()}
      </ScrollView>

      {/* Time Off Modal */}
      <Modal
        visible={timeOffModalVisible}
        onClose={() => {
          setTimeOffModalVisible(false);
          setSelectedCleanerForTimeOff(null);
          setTimeOffReason("");
        }}
        title="Mark Time Off"
      >
        {selectedCleanerForTimeOff && (
          <View>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={styles.timeOffCleanerName}>
                {selectedCleanerForTimeOff.name}
              </Text>
              <Text style={styles.timeOffDate}>
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </GlassCard>

            <InputField
              label="Reason (optional)"
              value={timeOffReason}
              onChangeText={setTimeOffReason}
              placeholder="e.g. Personal day, sick, etc."
              multiline
              numberOfLines={2}
              style={{ minHeight: 56, textAlignVertical: "top" }}
            />

            <View style={{ marginTop: 16, gap: 10 }}>
              <ActionButton
                title="Mark as Unavailable"
                onPress={handleTimeOffSubmit}
                variant="primary"
                loading={timeOffMutation.isPending}
              />
              <ActionButton
                title="Cancel"
                onPress={() => {
                  setTimeOffModalVisible(false);
                  setSelectedCleanerForTimeOff(null);
                }}
                variant="outline"
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  content: {
    padding: 16,
  },
  // View mode tabs
  viewModeTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    alignItems: "center",
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.border,
  },
  viewModeTabActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  viewModeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  viewModeTabTextActive: {
    color: Theme.primary,
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.primary + "33",
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.primary,
  },
  // Date nav
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateNavCenter: {
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  todayIndicator: {
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  todayIndicatorText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.primary,
  },
  // Revenue card
  revenueCard: {
    marginBottom: 16,
  },
  revenueRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  revenueLabel: {
    fontSize: 11,
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    textAlign: "center",
  },
  revenueValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.success,
    textAlign: "center",
    marginTop: 2,
  },
  // Section
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    color: Theme.mutedForeground,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: Theme.zinc400,
  },
  // Cleaners
  cleanerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  cleanerChip: {
    borderRadius: 8,
    backgroundColor: Theme.glassListItem,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    minWidth: 100,
  },
  cleanerChipOff: {
    borderColor: Theme.destructive + "33",
    backgroundColor: Theme.destructiveBg,
  },
  cleanerChipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cleanerChipName: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  cleanerChipNameOff: {
    textDecorationLine: "line-through",
    color: Theme.mutedForeground,
  },
  cleanerChipRole: {
    fontSize: 11,
    color: Theme.zinc400,
    marginTop: 2,
  },
  cleanerChipOffText: {
    fontSize: 11,
    color: Theme.destructive,
    fontWeight: "600",
    marginTop: 2,
  },
  // Role badge
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  // Save button
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Theme.primary,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  // Cards
  cardSpacing: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leadName: {
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
  },
  memberRow: {
    marginLeft: 28,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberRowOff: {
    opacity: 0.5,
  },
  memberName: {
    fontSize: 13,
    color: Theme.foreground,
    flex: 1,
  },
  memberNameOff: {
    textDecorationLine: "line-through",
    color: Theme.mutedForeground,
  },
  memberOffLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.destructive,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: Theme.destructiveBg,
    borderRadius: 3,
  },
  // Job block
  jobBlock: {
    marginTop: 8,
    marginLeft: 28,
    padding: 8,
    borderRadius: 6,
    backgroundColor: Theme.glassListItem,
    borderLeftWidth: 3,
    borderLeftColor: Theme.zinc500,
  },
  jobBlockName: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.foreground,
  },
  jobBlockTime: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginTop: 1,
  },
  jobBlockPrice: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.success,
    marginTop: 1,
  },
  // Week view
  weekHeaderRow: {
    flexDirection: "row",
  },
  weekDayHeader: {
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: Theme.border,
  },
  weekDayHeaderToday: {
    backgroundColor: Theme.primaryMuted,
    borderRadius: 6,
    borderBottomColor: Theme.primary,
  },
  weekDayName: {
    fontSize: 11,
    color: Theme.mutedForeground,
    fontWeight: "500",
  },
  weekDayNum: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
    marginTop: 2,
  },
  weekDayNumToday: {
    color: Theme.primary,
  },
  weekDayRevenue: {
    fontSize: 10,
    color: Theme.success,
    fontWeight: "500",
    marginTop: 2,
  },
  // Week team rows
  weekTeamRow: {
    marginTop: 8,
  },
  weekTeamLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  weekTeamLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.foreground,
  },
  weekTeamColumns: {
    flexDirection: "row",
  },
  weekDayCell: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    minHeight: 50,
    borderRightWidth: 1,
    borderRightColor: Theme.border,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  weekDayCellOff: {
    backgroundColor: Theme.destructiveBg,
  },
  weekCellOffText: {
    fontSize: 9,
    fontWeight: "700",
    color: Theme.destructive,
    textAlign: "center",
    marginTop: 4,
  },
  weekCellEmpty: {
    fontSize: 11,
    color: Theme.zinc600,
    textAlign: "center",
    marginTop: 12,
  },
  weekJobBlock: {
    borderRadius: 4,
    padding: 3,
    marginBottom: 2,
    borderLeftWidth: 2,
  },
  weekJobBlockText: {
    fontSize: 9,
    color: Theme.mutedForeground,
  },
  weekJobBlockName: {
    fontSize: 9,
    fontWeight: "600",
    color: Theme.foreground,
  },
  // Week revenue row
  weekRevenueRow: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: Theme.border,
    marginTop: 4,
  },
  weekRevenueCell: {
    alignItems: "center",
    paddingVertical: 6,
  },
  weekRevenueCellText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.success,
  },
  // Loading overlay
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  // Time off modal
  timeOffCleanerName: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  timeOffDate: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 4,
  },
});
