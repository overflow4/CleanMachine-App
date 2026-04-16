import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Alert, StyleSheet, TextInput, FlatList,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  fetchTeams, fetchTeamMessages, fetchTeamEarnings, manageTeam,
  sendEmployeeCredentials, reorderTeams, fetchCleanerJobs, sendSms, apiFetch,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton, ToggleField } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

type Tab = "teams" | "manage" | "messages" | "earnings";
type EarningsPeriod = "week" | "month";
type JobFilter = "today" | "upcoming" | "recent";

interface CleanerForm {
  name: string;
  phone: string;
  email: string;
  employee_type: "technician" | "salesman";
  is_team_lead: boolean;
}

interface TeamForm {
  name: string;
  lead_id: string;
}

const emptyCleanerForm: CleanerForm = {
  name: "",
  phone: "",
  email: "",
  employee_type: "technician",
  is_team_lead: false,
};

// ============================
// Sub-components
// ============================

function PeriodSelector({ value, onChange }: { value: EarningsPeriod; onChange: (v: EarningsPeriod) => void }) {
  return (
    <View style={s.periodRow}>
      {(["week", "month"] as EarningsPeriod[]).map((p) => (
        <TouchableOpacity
          key={p}
          onPress={() => onChange(p)}
          style={[s.periodBtn, value === p && s.periodBtnActive]}
        >
          <Text style={[s.periodBtnText, value === p && s.periodBtnTextActive]}>
            {p === "week" ? "Week" : "Month"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function JobFilterTabs({ value, onChange }: { value: JobFilter; onChange: (v: JobFilter) => void }) {
  return (
    <View style={s.periodRow}>
      {(["today", "upcoming", "recent"] as JobFilter[]).map((f) => (
        <TouchableOpacity
          key={f}
          onPress={() => onChange(f)}
          style={[s.periodBtn, value === f && s.periodBtnActive]}
        >
          <Text style={[s.periodBtnText, value === f && s.periodBtnTextActive]}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CredentialDisplay({ cleaner }: { cleaner: any }) {
  const username = cleaner.portal_username || cleaner.username || "";
  const pin = cleaner.portal_pin || cleaner.pin || "";

  if (!username && !pin) return null;

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  return (
    <View style={s.credentialBox}>
      {username ? (
        <View style={s.credentialRow}>
          <Text style={s.credentialLabel}>Username:</Text>
          <Text style={s.credentialValue}>{username}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(username, "Username")} style={s.copyBtn}>
            <Ionicons name="copy-outline" size={14} color={Theme.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
      {pin ? (
        <View style={s.credentialRow}>
          <Text style={s.credentialLabel}>PIN:</Text>
          <Text style={s.credentialValue}>{pin}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(pin, "PIN")} style={s.copyBtn}>
            <Ionicons name="copy-outline" size={14} color={Theme.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ============================
// Main Screen
// ============================

export default function TeamsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const queryClient = useQueryClient();

  // Cleaner modal state
  const [cleanerModalVisible, setCleanerModalVisible] = useState(false);
  const [editingCleaner, setEditingCleaner] = useState<any>(null);
  const [cleanerForm, setCleanerForm] = useState<CleanerForm>(emptyCleanerForm);

  // Team modal state
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  const [teamForm, setTeamForm] = useState<TeamForm>({ name: "", lead_id: "" });

  // Team detail modal (team lead earnings breakdown)
  const [teamDetailVisible, setTeamDetailVisible] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamDetailPeriod, setTeamDetailPeriod] = useState<EarningsPeriod>("week");

  // Cleaner jobs modal
  const [cleanerJobsVisible, setCleanerJobsVisible] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState<any>(null);
  const [jobFilter, setJobFilter] = useState<JobFilter>("today");

  // Reorder state
  const [reorderTeamId, setReorderTeamId] = useState<string | null>(null);
  const [reorderList, setReorderList] = useState<any[]>([]);
  const [reorderDirty, setReorderDirty] = useState(false);

  // Earnings period
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>("week");

  // SMS direct send state
  const [smsTarget, setSmsTarget] = useState<any>(null);
  const [smsMessage, setSmsMessage] = useState("");

  // ===== Queries =====

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const manageQuery = useQuery({
    queryKey: ["manage-teams"],
    queryFn: () => apiFetch("/api/manage-teams"),
    enabled: activeTab === "manage",
  });

  const messagesQuery = useQuery({
    queryKey: ["team-messages"],
    queryFn: () => fetchTeamMessages(),
    enabled: activeTab === "messages",
    refetchInterval: 15000,
  });

  const earningsQuery = useQuery({
    queryKey: ["team-earnings", earningsPeriod],
    queryFn: () => fetchTeamEarnings(undefined),
    enabled: activeTab === "earnings",
  });

  const teamDetailEarningsQuery = useQuery({
    queryKey: ["team-detail-earnings", selectedTeam?.id, teamDetailPeriod],
    queryFn: () => fetchTeamEarnings(String(selectedTeam?.id)),
    enabled: teamDetailVisible && !!selectedTeam?.id,
  });

  const cleanerJobsQuery = useQuery({
    queryKey: ["cleaner-jobs", selectedCleaner?.id, jobFilter],
    queryFn: () => fetchCleanerJobs(Number(selectedCleaner?.id), { filter: jobFilter }),
    enabled: cleanerJobsVisible && !!selectedCleaner?.id,
  });

  // ===== Mutations =====

  const credentialsMutation = useMutation({
    mutationFn: (cleanerId: number) => sendEmployeeCredentials(cleanerId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Credentials sent via SMS");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createCleanerMutation = useMutation({
    mutationFn: (data: CleanerForm) => manageTeam("create_cleaner", data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["manage-teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setCleanerModalVisible(false);
      setCleanerForm(emptyCleanerForm);
      Alert.alert("Success", "Cleaner created");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const updateCleanerMutation = useMutation({
    mutationFn: (data: { cleaner_id: number } & CleanerForm) => manageTeam("update_cleaner", data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["manage-teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setCleanerModalVisible(false);
      setEditingCleaner(null);
      setCleanerForm(emptyCleanerForm);
      Alert.alert("Success", "Cleaner updated");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteCleanerMutation = useMutation({
    mutationFn: (cleanerId: number) => manageTeam("delete_cleaner", { cleaner_id: cleanerId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["manage-teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setCleanerModalVisible(false);
      setEditingCleaner(null);
      setCleanerForm(emptyCleanerForm);
      Alert.alert("Success", "Cleaner deleted");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createTeamMutation = useMutation({
    mutationFn: (data: TeamForm) => manageTeam("create_team", data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["manage-teams"] });
      setTeamModalVisible(false);
      setTeamForm({ name: "", lead_id: "" });
      Alert.alert("Success", "Team created");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: number) => manageTeam("delete_team", { team_id: teamId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["manage-teams"] });
      Alert.alert("Success", "Team deleted");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (data: { teamId: string; cleanerIds: number[] }) => reorderTeams(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setReorderTeamId(null);
      setReorderList([]);
      setReorderDirty(false);
      Alert.alert("Success", "Team order saved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const smsMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) => sendSms(to, message),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSmsMessage("");
      setSmsTarget(null);
      Alert.alert("Success", "SMS sent");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // ===== Parse data =====

  const teamsRaw: any = teamsQuery.data;
  const teamsList: any[] = Array.isArray(teamsRaw?.data) ? teamsRaw.data : Object.values(teamsRaw?.data ?? {});
  const unassigned: any[] = teamsRaw?.unassigned_cleaners ?? [];

  const manageRaw: any = manageQuery.data;
  const allCleaners: any[] = manageRaw?.data?.cleaners ?? manageRaw?.cleaners ?? [];

  const messages: any[] = (messagesQuery.data as any)?.messages ?? (messagesQuery.data as any)?.data ?? [];
  const earningsRaw: any = earningsQuery.data;
  const earnings: any[] = earningsRaw?.earnings ?? earningsRaw?.data ?? [];

  const teamDetailEarnings: any[] = (teamDetailEarningsQuery.data as any)?.earnings
    ?? (teamDetailEarningsQuery.data as any)?.data ?? [];

  const cleanerJobs: any[] = (cleanerJobsQuery.data as any)?.jobs
    ?? (cleanerJobsQuery.data as any)?.data ?? [];

  // Group messages by sender for bubble grouping
  const groupedMessages = useMemo(() => {
    const groups: { sender: string; isOutbound: boolean; messages: any[] }[] = [];
    let currentGroup: { sender: string; isOutbound: boolean; messages: any[] } | null = null;

    for (const msg of messages) {
      const isOutbound = msg.is_mine || msg.direction === "outbound";
      const sender = msg.sender_name || msg.cleaner_name || "Unknown";

      if (!currentGroup || currentGroup.sender !== sender || currentGroup.isOutbound !== isOutbound) {
        currentGroup = { sender, isOutbound, messages: [] };
        groups.push(currentGroup);
      }
      currentGroup.messages.push(msg);
    }

    return groups;
  }, [messages]);

  // ===== Handlers =====

  const onRefresh = useCallback(async () => {
    await Promise.all([
      teamsQuery.refetch(),
      activeTab === "manage" ? manageQuery.refetch() : Promise.resolve(),
      activeTab === "messages" ? messagesQuery.refetch() : Promise.resolve(),
      activeTab === "earnings" ? earningsQuery.refetch() : Promise.resolve(),
    ]);
  }, [activeTab]);

  const openCreateCleaner = () => {
    setEditingCleaner(null);
    setCleanerForm(emptyCleanerForm);
    setCleanerModalVisible(true);
  };

  const openEditCleaner = (cleaner: any) => {
    setEditingCleaner(cleaner);
    setCleanerForm({
      name: cleaner.name || "",
      phone: cleaner.phone || "",
      email: cleaner.email || "",
      employee_type: cleaner.employee_type || "technician",
      is_team_lead: cleaner.is_team_lead ?? false,
    });
    setCleanerModalVisible(true);
  };

  const handleSaveCleaner = () => {
    if (!cleanerForm.name.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }
    if (editingCleaner) {
      updateCleanerMutation.mutate({ cleaner_id: Number(editingCleaner.id), ...cleanerForm });
    } else {
      createCleanerMutation.mutate(cleanerForm);
    }
  };

  const handleDeleteCleaner = () => {
    if (!editingCleaner) return;
    Alert.alert(
      "Delete Cleaner",
      `Are you sure you want to delete ${editingCleaner.name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCleanerMutation.mutate(Number(editingCleaner.id)),
        },
      ]
    );
  };

  const handleDeleteTeam = (team: any) => {
    Alert.alert(
      "Delete Team",
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTeamMutation.mutate(Number(team.id)),
        },
      ]
    );
  };

  const openCreateTeam = () => {
    setTeamForm({ name: "", lead_id: "" });
    setTeamModalVisible(true);
  };

  const handleSaveTeam = () => {
    if (!teamForm.name.trim()) {
      Alert.alert("Validation", "Team name is required");
      return;
    }
    createTeamMutation.mutate(teamForm);
  };

  // Team detail (lead earnings breakdown)
  const openTeamDetail = (team: any) => {
    setSelectedTeam(team);
    setTeamDetailPeriod("week");
    setTeamDetailVisible(true);
  };

  // Cleaner jobs
  const openCleanerJobs = (cleaner: any) => {
    setSelectedCleaner(cleaner);
    setJobFilter("today");
    setCleanerJobsVisible(true);
  };

  // Reorder
  const startReorder = (team: any) => {
    setReorderTeamId(String(team.id));
    setReorderList([...(team.members || [])]);
    setReorderDirty(false);
  };

  const cancelReorder = () => {
    setReorderTeamId(null);
    setReorderList([]);
    setReorderDirty(false);
  };

  const moveCleanerUp = (index: number) => {
    if (index <= 0) return;
    const list = [...reorderList];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    setReorderList(list);
    setReorderDirty(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const moveCleanerDown = (index: number) => {
    if (index >= reorderList.length - 1) return;
    const list = [...reorderList];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    setReorderList(list);
    setReorderDirty(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveReorder = () => {
    if (!reorderTeamId) return;
    const cleanerIds = reorderList.map((m: any) => Number(m.id));
    reorderMutation.mutate({ teamId: reorderTeamId, cleanerIds });
  };

  // SMS direct send
  const handleSendSms = () => {
    if (!smsTarget?.phone || !smsMessage.trim()) {
      Alert.alert("Validation", "Phone and message are required");
      return;
    }
    smsMutation.mutate({ to: smsTarget.phone, message: smsMessage.trim() });
  };

  // ===== Loading state =====

  if (teamsQuery.isLoading) return <LoadingScreen message="Loading teams..." />;

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "teams", label: "Teams", icon: "people-outline" },
    { key: "manage", label: "Manage", icon: "settings-outline" },
    { key: "messages", label: "Messages", icon: "chatbubbles-outline" },
    { key: "earnings", label: "Earnings", icon: "cash-outline" },
  ];

  const isSaving = createCleanerMutation.isPending || updateCleanerMutation.isPending;

  // Compute total earnings metrics
  const totalRevenue = earnings.reduce((sum: number, e: any) => sum + Number(e.total_earnings ?? e.revenue ?? 0), 0);
  const totalJobs = earnings.reduce((sum: number, e: any) => sum + Number(e.jobs_completed ?? e.jobsCompleted ?? 0), 0);
  const totalTips = earnings.reduce((sum: number, e: any) => sum + Number(e.tips ?? 0), 0);
  const totalUpsells = earnings.reduce((sum: number, e: any) => sum + Number(e.upsells ?? e.upsell_revenue ?? 0), 0);

  return (
    <View style={s.container}>
      {/* Tab Bar */}
      <View style={s.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={teamsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />
        }
      >
        {/* ==================== TEAMS TAB ==================== */}
        {activeTab === "teams" && (
          <>
            {teamsList.length === 0 ? (
              <EmptyState icon="people-outline" title="No teams" description="Teams will appear here" />
            ) : (
              teamsList.map((team: any, i: number) => {
                const isReordering = reorderTeamId === String(team.id);
                const membersToShow = isReordering ? reorderList : (team.members || []);

                return (
                  <GlassCard key={team.id || i} style={{ marginBottom: 12 }}>
                    {/* Team Header */}
                    <TouchableOpacity activeOpacity={0.7} onPress={() => openTeamDetail(team)}>
                      <View style={s.teamHeader}>
                        <View style={[s.teamIcon, { backgroundColor: "rgba(0,145,255,0.1)" }]}>
                          <Ionicons name="people" size={18} color={Theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.teamName}>{team.name}</Text>
                          <Text style={s.sub}>{team.members?.length ?? 0} members</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {!isReordering ? (
                            <TouchableOpacity
                              onPress={() => startReorder(team)}
                              style={s.iconBtn}
                            >
                              <Ionicons name="swap-vertical-outline" size={16} color={Theme.mutedForeground} />
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity onPress={() => handleDeleteTeam(team)} style={s.deleteTeamBtn}>
                            <Ionicons name="trash-outline" size={16} color={Theme.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Reorder controls */}
                    {isReordering && (
                      <View style={s.reorderHeader}>
                        <Text style={s.reorderTitle}>Reorder Members</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity onPress={cancelReorder} style={s.reorderCancelBtn}>
                            <Text style={s.reorderCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          {reorderDirty && (
                            <TouchableOpacity onPress={saveReorder} style={s.reorderSaveBtn}>
                              {reorderMutation.isPending ? (
                                <Text style={s.reorderSaveText}>Saving...</Text>
                              ) : (
                                <Text style={s.reorderSaveText}>Save Order</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Members list */}
                    {membersToShow.map((m: any, j: number) => (
                      <View key={m.id || j} style={s.memberRow}>
                        {isReordering && (
                          <View style={s.reorderControls}>
                            <TouchableOpacity
                              onPress={() => moveCleanerUp(j)}
                              disabled={j === 0}
                              style={[s.reorderArrow, j === 0 && { opacity: 0.3 }]}
                            >
                              <Ionicons name="chevron-up" size={16} color={Theme.primary} />
                            </TouchableOpacity>
                            <Text style={s.reorderIndex}>{j + 1}</Text>
                            <TouchableOpacity
                              onPress={() => moveCleanerDown(j)}
                              disabled={j === membersToShow.length - 1}
                              style={[s.reorderArrow, j === membersToShow.length - 1 && { opacity: 0.3 }]}
                            >
                              <Ionicons name="chevron-down" size={16} color={Theme.primary} />
                            </TouchableOpacity>
                          </View>
                        )}
                        <View
                          style={[
                            s.memberAvatar,
                            m.role === "technician" || String(m.id) === String(team.lead_id)
                              ? { backgroundColor: "rgba(0,145,255,0.1)" }
                              : { backgroundColor: Theme.warningBg },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: String(m.id) === String(team.lead_id) ? Theme.primary : Theme.warning,
                            }}
                          >
                            {m.name?.[0]?.toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.memberName}>{m.name}</Text>
                          <Text style={s.sub}>{m.phone || ""}</Text>
                        </View>
                        {!isReordering && (
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            {String(m.id) === String(team.lead_id) && (
                              <View style={[s.badge, { backgroundColor: "rgba(0,145,255,0.1)" }]}>
                                <Text style={[s.badgeText, { color: Theme.primary }]}>Lead</Text>
                              </View>
                            )}
                            <Text style={s.roleText}>{m.employee_type || m.role || ""}</Text>
                            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                              <TouchableOpacity
                                onPress={() => openCleanerJobs(m)}
                                style={s.smallActionBtn}
                              >
                                <Ionicons name="briefcase-outline" size={12} color={Theme.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => { setSmsTarget(m); setSmsMessage(""); }}
                                style={s.smallActionBtn}
                              >
                                <Ionicons name="chatbubble-outline" size={12} color={Theme.success} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </GlassCard>
                );
              })
            )}

            {/* Unassigned cleaners */}
            {unassigned.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={s.sectionLabel}>Unassigned ({unassigned.length})</Text>
                {unassigned.map((c: any, i: number) => (
                  <GlassCard key={c.id || i} style={{ marginBottom: 6 }}>
                    <View style={s.memberRow}>
                      <View style={[s.memberAvatar, { backgroundColor: Theme.destructiveBg }]}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: Theme.destructive }}>
                          {c.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{c.name}</Text>
                        <Text style={s.sub}>{c.phone || ""}</Text>
                      </View>
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}
          </>
        )}

        {/* ==================== MANAGE TAB ==================== */}
        {activeTab === "manage" && (
          <>
            <View style={s.manageActions}>
              <TouchableOpacity onPress={openCreateCleaner} style={s.manageBtn}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <Text style={s.manageBtnText}>Create Cleaner</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openCreateTeam} style={[s.manageBtn, { backgroundColor: Theme.success }]}>
                <Ionicons name="people-outline" size={16} color="#fff" />
                <Text style={s.manageBtnText}>Create Team</Text>
              </TouchableOpacity>
            </View>

            {manageQuery.isLoading ? (
              <LoadingScreen message="Loading..." />
            ) : allCleaners.length === 0 ? (
              <EmptyState icon="people-outline" title="No cleaners" />
            ) : (
              allCleaners.map((cleaner: any, i: number) => (
                <TouchableOpacity key={cleaner.id || i} activeOpacity={0.7} onPress={() => openEditCleaner(cleaner)}>
                  <GlassCard style={{ marginBottom: 8 }}>
                    <View style={s.memberRow}>
                      <View
                        style={[
                          s.memberAvatar,
                          {
                            backgroundColor:
                              cleaner.active !== false ? "rgba(0,145,255,0.1)" : Theme.destructiveBg,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: cleaner.active !== false ? Theme.primary : Theme.destructive,
                          }}
                        >
                          {cleaner.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{cleaner.name}</Text>
                        <Text style={s.sub}>
                          {cleaner.phone || ""}{" "}
                          {cleaner.employee_type ? `• ${cleaner.employee_type}` : ""}
                        </Text>
                        {/* Portal credentials inline */}
                        <CredentialDisplay cleaner={cleaner} />
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <View
                          style={[
                            s.badge,
                            {
                              backgroundColor:
                                cleaner.active !== false ? Theme.successBg : Theme.destructiveBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.badgeText,
                              {
                                color: cleaner.active !== false ? Theme.success : Theme.destructive,
                              },
                            ]}
                          >
                            {cleaner.active !== false ? "Active" : "Inactive"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            cleaner.id && credentialsMutation.mutate(Number(cleaner.id));
                          }}
                          style={s.credBtn}
                        >
                          <Ionicons name="send-outline" size={11} color={Theme.primary} style={{ marginRight: 4 }} />
                          <Text style={s.credBtnText}>Send Credentials</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            openCleanerJobs(cleaner);
                          }}
                          style={s.credBtn}
                        >
                          <Ionicons name="briefcase-outline" size={11} color={Theme.mutedForeground} style={{ marginRight: 4 }} />
                          <Text style={s.credBtnText}>View Jobs</Text>
                        </TouchableOpacity>
                        {cleaner.phone && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setSmsTarget(cleaner);
                              setSmsMessage("");
                            }}
                            style={s.credBtn}
                          >
                            <Ionicons name="chatbubble-outline" size={11} color={Theme.success} style={{ marginRight: 4 }} />
                            <Text style={s.credBtnText}>Send SMS</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ==================== MESSAGES TAB ==================== */}
        {activeTab === "messages" &&
          (messagesQuery.isLoading ? (
            <LoadingScreen message="Loading messages..." />
          ) : messages.length === 0 ? (
            <EmptyState icon="chatbubbles-outline" title="No messages" />
          ) : (
            groupedMessages.map((group, gi) => (
              <View key={gi} style={{ marginBottom: 12 }}>
                <Text
                  style={[
                    s.bubbleSender,
                    { textAlign: group.isOutbound ? "right" : "left" },
                  ]}
                >
                  {group.sender}
                </Text>
                {group.messages.map((msg: any, mi: number) => {
                  const isOutbound = msg.is_mine || msg.direction === "outbound";
                  return (
                    <View
                      key={mi}
                      style={[
                        s.bubbleRow,
                        { justifyContent: isOutbound ? "flex-end" : "flex-start" },
                      ]}
                    >
                      <View
                        style={[
                          s.bubble,
                          isOutbound ? s.bubbleOutbound : s.bubbleInbound,
                          mi === 0 && (isOutbound ? s.bubbleFirstOutbound : s.bubbleFirstInbound),
                        ]}
                      >
                        <Text
                          style={[
                            s.bubbleText,
                            { color: isOutbound ? "#fff" : Theme.foreground },
                          ]}
                        >
                          {msg.content || msg.message || ""}
                        </Text>
                        <Text
                          style={[
                            s.bubbleTime,
                            { color: isOutbound ? "rgba(255,255,255,0.6)" : Theme.mutedForeground },
                          ]}
                        >
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          ))}

        {/* ==================== EARNINGS TAB ==================== */}
        {activeTab === "earnings" && (
          <>
            {/* Period selector */}
            <PeriodSelector value={earningsPeriod} onChange={setEarningsPeriod} />

            {/* Summary metrics */}
            <View style={s.metricsRow}>
              <MetricCard
                title="Total Revenue"
                value={`$${totalRevenue.toLocaleString()}`}
                icon="cash-outline"
                iconColor={Theme.success}
                compact
              />
              <MetricCard
                title="Total Jobs"
                value={totalJobs}
                icon="briefcase-outline"
                iconColor={Theme.primary}
                compact
              />
            </View>
            <View style={[s.metricsRow, { marginBottom: 16 }]}>
              <MetricCard
                title="Tips"
                value={`$${totalTips.toLocaleString()}`}
                icon="heart-outline"
                iconColor={Theme.warning}
                compact
              />
              <MetricCard
                title="Upsells"
                value={`$${totalUpsells.toLocaleString()}`}
                icon="trending-up-outline"
                iconColor={Theme.violet400}
                compact
              />
            </View>

            {/* Individual earnings */}
            {earningsQuery.isLoading ? (
              <LoadingScreen message="Loading earnings..." />
            ) : earnings.length === 0 ? (
              <EmptyState icon="cash-outline" title="No earnings data" />
            ) : (
              earnings.map((item: any, i: number) => (
                <GlassCard key={i} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>
                        {item.cleaner_name || item.name || `Cleaner ${i + 1}`}
                      </Text>
                      <Text style={s.sub}>
                        {item.jobs_completed ?? item.jobsCompleted ?? 0} jobs
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: Theme.success }}>
                        ${Number(item.total_earnings ?? item.revenue ?? 0).toLocaleString()}
                      </Text>
                      {/* Revenue breakdown */}
                      <View style={s.earningsBreakdown}>
                        {Number(item.tips ?? 0) > 0 && (
                          <Text style={s.earningsSubMetric}>
                            Tips: ${Number(item.tips).toLocaleString()}
                          </Text>
                        )}
                        {Number(item.upsells ?? item.upsell_revenue ?? 0) > 0 && (
                          <Text style={s.earningsSubMetric}>
                            Upsells: ${Number(item.upsells ?? item.upsell_revenue ?? 0).toLocaleString()}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ==================== MODALS ==================== */}

      {/* Create / Edit Cleaner Modal */}
      <Modal
        visible={cleanerModalVisible}
        onClose={() => {
          setCleanerModalVisible(false);
          setEditingCleaner(null);
          setCleanerForm(emptyCleanerForm);
        }}
        title={editingCleaner ? "Edit Cleaner" : "Create Cleaner"}
      >
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          <InputField
            label="Name"
            value={cleanerForm.name}
            onChangeText={(v: string) => setCleanerForm((f) => ({ ...f, name: v }))}
          />
          <InputField
            label="Phone"
            value={cleanerForm.phone}
            onChangeText={(v: string) => setCleanerForm((f) => ({ ...f, phone: v }))}
          />
          <InputField
            label="Email"
            value={cleanerForm.email}
            onChangeText={(v: string) => setCleanerForm((f) => ({ ...f, email: v }))}
          />

          <Text style={s.fieldLabel}>Employee Type</Text>
          <View style={s.typeRow}>
            <TouchableOpacity
              onPress={() => setCleanerForm((f) => ({ ...f, employee_type: "technician" }))}
              style={[s.typeBtn, cleanerForm.employee_type === "technician" && s.typeBtnActive]}
            >
              <Text
                style={[
                  s.typeBtnText,
                  cleanerForm.employee_type === "technician" && s.typeBtnTextActive,
                ]}
              >
                Technician
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCleanerForm((f) => ({ ...f, employee_type: "salesman" }))}
              style={[s.typeBtn, cleanerForm.employee_type === "salesman" && s.typeBtnActive]}
            >
              <Text
                style={[
                  s.typeBtnText,
                  cleanerForm.employee_type === "salesman" && s.typeBtnTextActive,
                ]}
              >
                Salesman
              </Text>
            </TouchableOpacity>
          </View>

          <ToggleField
            label="Team Lead"
            value={cleanerForm.is_team_lead}
            onValueChange={(v: boolean) => setCleanerForm((f) => ({ ...f, is_team_lead: v }))}
          />

          {/* Show portal credentials if editing */}
          {editingCleaner && <CredentialDisplay cleaner={editingCleaner} />}

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton
              title={editingCleaner ? "Save Changes" : "Create Cleaner"}
              onPress={handleSaveCleaner}
              variant="primary"
              loading={isSaving}
            />
            {editingCleaner && (
              <>
                <ActionButton
                  title="Send Credentials via SMS"
                  onPress={() => credentialsMutation.mutate(Number(editingCleaner.id))}
                  variant="outline"
                  loading={credentialsMutation.isPending}
                />
                <ActionButton
                  title="Delete Cleaner"
                  onPress={handleDeleteCleaner}
                  variant="danger"
                  loading={deleteCleanerMutation.isPending}
                />
              </>
            )}
          </View>
        </ScrollView>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        visible={teamModalVisible}
        onClose={() => {
          setTeamModalVisible(false);
          setTeamForm({ name: "", lead_id: "" });
        }}
        title="Create Team"
      >
        <InputField
          label="Team Name"
          value={teamForm.name}
          onChangeText={(v: string) => setTeamForm((f) => ({ ...f, name: v }))}
        />

        <Text style={s.fieldLabel}>Team Lead</Text>
        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
          {allCleaners.length === 0 ? (
            <Text style={s.sub}>No cleaners available. Create cleaners first.</Text>
          ) : (
            allCleaners.map((c: any) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setTeamForm((f) => ({ ...f, lead_id: String(c.id) }))}
                style={[s.leadOption, String(c.id) === teamForm.lead_id && s.leadOptionActive]}
              >
                <Text
                  style={[
                    s.leadOptionText,
                    String(c.id) === teamForm.lead_id && s.leadOptionTextActive,
                  ]}
                >
                  {c.name}
                </Text>
                {String(c.id) === teamForm.lead_id && (
                  <Ionicons name="checkmark-circle" size={18} color={Theme.primary} />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <View style={{ marginTop: 16 }}>
          <ActionButton
            title="Create Team"
            onPress={handleSaveTeam}
            variant="primary"
            loading={createTeamMutation.isPending}
          />
        </View>
      </Modal>

      {/* Team Lead Detail / Earnings Breakdown Modal */}
      <Modal
        visible={teamDetailVisible}
        onClose={() => {
          setTeamDetailVisible(false);
          setSelectedTeam(null);
        }}
        title={selectedTeam?.name ? `${selectedTeam.name} — Earnings` : "Team Earnings"}
      >
        <PeriodSelector value={teamDetailPeriod} onChange={setTeamDetailPeriod} />

        {teamDetailEarningsQuery.isLoading ? (
          <View style={{ paddingVertical: 32 }}>
            <LoadingScreen message="Loading earnings..." />
          </View>
        ) : teamDetailEarnings.length === 0 ? (
          <EmptyState icon="cash-outline" title="No earnings data" />
        ) : (
          <>
            {/* Team total summary */}
            {(() => {
              const teamTotal = teamDetailEarnings.reduce(
                (sum: number, e: any) => sum + Number(e.total_earnings ?? e.revenue ?? 0),
                0
              );
              const teamJobs = teamDetailEarnings.reduce(
                (sum: number, e: any) => sum + Number(e.jobs_completed ?? e.jobsCompleted ?? 0),
                0
              );
              const teamTips = teamDetailEarnings.reduce(
                (sum: number, e: any) => sum + Number(e.tips ?? 0),
                0
              );
              return (
                <GlassCard style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: Theme.success }}>
                        ${teamTotal.toLocaleString()}
                      </Text>
                      <Text style={s.sub}>Revenue</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: Theme.primary }}>
                        {teamJobs}
                      </Text>
                      <Text style={s.sub}>Jobs</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: Theme.warning }}>
                        ${teamTips.toLocaleString()}
                      </Text>
                      <Text style={s.sub}>Tips</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })()}

            {/* Per-member breakdown */}
            {teamDetailEarnings.map((item: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>
                      {item.cleaner_name || item.name || `Member ${i + 1}`}
                    </Text>
                    <Text style={s.sub}>
                      {item.jobs_completed ?? item.jobsCompleted ?? 0} jobs
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: Theme.success }}>
                      ${Number(item.total_earnings ?? item.revenue ?? 0).toLocaleString()}
                    </Text>
                    <View style={s.earningsBreakdown}>
                      {Number(item.tips ?? 0) > 0 && (
                        <Text style={s.earningsSubMetric}>
                          Tips: ${Number(item.tips).toLocaleString()}
                        </Text>
                      )}
                      {Number(item.upsells ?? item.upsell_revenue ?? 0) > 0 && (
                        <Text style={s.earningsSubMetric}>
                          Upsells: ${Number(item.upsells ?? item.upsell_revenue ?? 0).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </GlassCard>
            ))}
          </>
        )}
      </Modal>

      {/* Cleaner Jobs Modal */}
      <Modal
        visible={cleanerJobsVisible}
        onClose={() => {
          setCleanerJobsVisible(false);
          setSelectedCleaner(null);
        }}
        title={selectedCleaner?.name ? `${selectedCleaner.name} — Jobs` : "Cleaner Jobs"}
      >
        <JobFilterTabs value={jobFilter} onChange={setJobFilter} />

        {cleanerJobsQuery.isLoading ? (
          <View style={{ paddingVertical: 32 }}>
            <LoadingScreen message="Loading jobs..." />
          </View>
        ) : cleanerJobs.length === 0 ? (
          <EmptyState icon="briefcase-outline" title={`No ${jobFilter} jobs`} />
        ) : (
          cleanerJobs.map((job: any, i: number) => (
            <GlassCard key={job.id || i} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>
                    {job.customer_name || job.title || `Job #${job.id}`}
                  </Text>
                  <Text style={s.sub}>
                    {job.scheduled_date
                      ? new Date(job.scheduled_date).toLocaleDateString()
                      : job.date || ""}
                    {job.scheduled_time ? ` at ${job.scheduled_time}` : ""}
                  </Text>
                  {job.address && <Text style={s.sub}>{job.address}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {job.status && (
                    <View
                      style={[
                        s.badge,
                        {
                          backgroundColor:
                            job.status === "completed"
                              ? Theme.successBg
                              : job.status === "cancelled"
                              ? Theme.destructiveBg
                              : Theme.infoBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.badgeText,
                          {
                            color:
                              job.status === "completed"
                                ? Theme.success
                                : job.status === "cancelled"
                                ? Theme.destructive
                                : Theme.primary,
                          },
                        ]}
                      >
                        {job.status}
                      </Text>
                    </View>
                  )}
                  {(job.price || job.amount) && (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: Theme.success, marginTop: 4 }}>
                      ${Number(job.price ?? job.amount ?? 0).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </Modal>

      {/* SMS Direct Send Modal */}
      <Modal
        visible={!!smsTarget}
        onClose={() => {
          setSmsTarget(null);
          setSmsMessage("");
        }}
        title={smsTarget ? `SMS to ${smsTarget.name}` : "Send SMS"}
      >
        <View>
          <Text style={s.sub}>
            Sending to: {smsTarget?.phone || "No phone number"}
          </Text>
          <View style={{ marginTop: 12 }}>
            <InputField
              label="Message"
              value={smsMessage}
              onChangeText={setSmsMessage}
              multiline
              placeholder="Type your message..."
            />
          </View>
          <View style={{ marginTop: 16 }}>
            <ActionButton
              title="Send SMS"
              onPress={handleSendSms}
              variant="primary"
              loading={smsMutation.isPending}
              disabled={!smsTarget?.phone || !smsMessage.trim()}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================
// Styles
// ============================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  tab: { flex: 1, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  tabActive: { backgroundColor: Theme.card },
  tabText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },

  // Team header
  teamHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  teamIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 16, fontWeight: "600", color: Theme.foreground },

  // Members
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  memberName: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  sub: { fontSize: 12, color: Theme.mutedForeground, marginTop: 1 },

  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500" },
  roleText: { fontSize: 11, color: Theme.mutedForeground, marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Credential buttons
  credBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  credBtnText: { fontSize: 11, fontWeight: "500", color: Theme.mutedForeground },

  // Manage actions
  manageActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  manageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  manageBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  // Delete team button
  deleteTeamBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.destructiveBg },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.muted },

  // Small action buttons (on member rows)
  smallActionBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: "600", color: Theme.mutedForeground, marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, alignItems: "center" },
  typeBtnActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.1)" },
  typeBtnText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  typeBtnTextActive: { color: Theme.primary },

  // Lead option (team create modal)
  leadOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  leadOptionActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.1)" },
  leadOptionText: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  leadOptionTextActive: { color: Theme.primary },

  // Chat bubble styles
  bubbleSender: { fontSize: 11, fontWeight: "600", color: Theme.mutedForeground, marginBottom: 4, paddingHorizontal: 4 },
  bubbleRow: { flexDirection: "row", marginBottom: 3 },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleOutbound: { backgroundColor: Theme.primary, borderBottomRightRadius: 6 },
  bubbleInbound: { backgroundColor: Theme.card, borderWidth: 1, borderColor: Theme.border, borderBottomLeftRadius: 6 },
  bubbleFirstOutbound: { borderTopRightRadius: 18 },
  bubbleFirstInbound: { borderTopLeftRadius: 18 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: "right" },

  // Period selector
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    backgroundColor: Theme.muted,
    borderRadius: 8,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  periodBtnActive: { backgroundColor: Theme.card },
  periodBtnText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  periodBtnTextActive: { color: Theme.primary },

  // Metrics row
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  // Earnings breakdown
  earningsBreakdown: { marginTop: 2, gap: 1 },
  earningsSubMetric: { fontSize: 11, color: Theme.mutedForeground },

  // Reorder
  reorderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    marginTop: 8,
  },
  reorderTitle: { fontSize: 13, fontWeight: "600", color: Theme.warning },
  reorderCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  reorderCancelText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  reorderSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Theme.primary,
  },
  reorderSaveText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  reorderControls: { alignItems: "center", gap: 0, marginRight: 4 },
  reorderArrow: { padding: 2 },
  reorderIndex: { fontSize: 11, fontWeight: "700", color: Theme.primary, minWidth: 16, textAlign: "center" },

  // Credential display
  credentialBox: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: Theme.muted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.border,
    gap: 4,
  },
  credentialRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  credentialLabel: { fontSize: 11, fontWeight: "600", color: Theme.mutedForeground },
  credentialValue: { fontSize: 12, fontWeight: "500", color: Theme.foreground, fontFamily: "monospace" },
  copyBtn: { padding: 4 },
});
