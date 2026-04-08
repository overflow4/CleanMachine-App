import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Alert, StyleSheet, TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchTeams, fetchTeamMessages, fetchTeamEarnings, manageTeam, sendEmployeeCredentials, apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton, ToggleField } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

type Tab = "teams" | "manage" | "messages" | "earnings";

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
  });

  const earningsQuery = useQuery({
    queryKey: ["team-earnings"],
    queryFn: () => fetchTeamEarnings(),
    enabled: activeTab === "earnings",
  });

  const credentialsMutation = useMutation({
    mutationFn: (cleanerId: number) => sendEmployeeCredentials(cleanerId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Credentials sent");
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

  // Parse teams data — API returns { data: Team[], unassigned_cleaners: Cleaner[] }
  const teamsRaw: any = teamsQuery.data;
  const teamsList: any[] = Array.isArray(teamsRaw?.data) ? teamsRaw.data : Object.values(teamsRaw?.data ?? {});
  const unassigned: any[] = teamsRaw?.unassigned_cleaners ?? [];

  // Parse manage data — API returns { data: { cleaners: Cleaner[] } }
  const manageRaw: any = manageQuery.data;
  const allCleaners: any[] = manageRaw?.data?.cleaners ?? manageRaw?.cleaners ?? [];

  const messages: any[] = (messagesQuery.data as any)?.messages ?? (messagesQuery.data as any)?.data ?? [];
  const earnings: any[] = (earningsQuery.data as any)?.earnings ?? (earningsQuery.data as any)?.data ?? [];

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

  if (teamsQuery.isLoading) return <LoadingScreen message="Loading teams..." />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "teams", label: "Teams" },
    { key: "manage", label: "Manage" },
    { key: "messages", label: "Messages" },
    { key: "earnings", label: "Earnings" },
  ];

  const isSaving = createCleanerMutation.isPending || updateCleanerMutation.isPending;

  return (
    <View style={s.container}>
      <View style={s.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tab, activeTab === tab.key && s.tabActive]}>
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={teamsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />}>

        {/* Teams Tab — shows crews with members */}
        {activeTab === "teams" && (
          <>
            {teamsList.length === 0 ? (
              <EmptyState icon="people-outline" title="No teams" description="Teams will appear here" />
            ) : (
              teamsList.map((team: any, i: number) => (
                <GlassCard key={team.id || i} style={{ marginBottom: 12 }}>
                  <View style={s.teamHeader}>
                    <View style={[s.teamIcon, { backgroundColor: "rgba(0,145,255,0.1)" }]}>
                      <Ionicons name="people" size={18} color={Theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.teamName}>{team.name}</Text>
                      <Text style={s.sub}>{team.members?.length ?? 0} members</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteTeam(team)} style={s.deleteTeamBtn}>
                      <Ionicons name="trash-outline" size={16} color={Theme.destructive} />
                    </TouchableOpacity>
                  </View>
                  {team.members?.map((m: any, j: number) => (
                    <View key={m.id || j} style={s.memberRow}>
                      <View style={[s.memberAvatar, m.role === "technician" || m.id === team.lead_id ? { backgroundColor: "rgba(0,145,255,0.1)" } : { backgroundColor: Theme.warningBg }]}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: m.id === team.lead_id ? Theme.primary : Theme.warning }}>
                          {m.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{m.name}</Text>
                        <Text style={s.sub}>{m.phone || ""}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {String(m.id) === String(team.lead_id) && (
                          <View style={[s.badge, { backgroundColor: "rgba(0,145,255,0.1)" }]}>
                            <Text style={[s.badgeText, { color: Theme.primary }]}>Lead</Text>
                          </View>
                        )}
                        <Text style={s.roleText}>{m.employee_type || m.role || ""}</Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              ))
            )}
            {unassigned.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={s.sectionLabel}>Unassigned ({unassigned.length})</Text>
                {unassigned.map((c: any, i: number) => (
                  <GlassCard key={c.id || i} style={{ marginBottom: 6 }}>
                    <View style={s.memberRow}>
                      <View style={[s.memberAvatar, { backgroundColor: Theme.destructiveBg }]}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: Theme.destructive }}>{c.name?.[0]?.toUpperCase() || "?"}</Text>
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

        {/* Manage Tab — all cleaners with actions */}
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
                      <View style={[s.memberAvatar, { backgroundColor: cleaner.active !== false ? "rgba(0,145,255,0.1)" : Theme.destructiveBg }]}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: cleaner.active !== false ? Theme.primary : Theme.destructive }}>
                          {cleaner.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{cleaner.name}</Text>
                        <Text style={s.sub}>{cleaner.phone || ""} {cleaner.employee_type ? `• ${cleaner.employee_type}` : ""}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <View style={[s.badge, { backgroundColor: cleaner.active !== false ? Theme.successBg : Theme.destructiveBg }]}>
                          <Text style={[s.badgeText, { color: cleaner.active !== false ? Theme.success : Theme.destructive }]}>
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
                          <Text style={s.credBtnText}>Send Credentials</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          messages.length === 0 ? (
            <EmptyState icon="chatbubbles-outline" title="No messages" />
          ) : (
            messages.map((msg: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <Text style={s.memberName}>{msg.sender_name || msg.cleaner_name || "Unknown"}</Text>
                <Text style={{ fontSize: 13, color: Theme.foreground, opacity: 0.8, marginTop: 4 }}>{msg.content || msg.message || ""}</Text>
                <Text style={s.sub}>{msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}</Text>
              </GlassCard>
            ))
          )
        )}

        {/* Earnings Tab */}
        {activeTab === "earnings" && (
          earnings.length === 0 ? (
            <EmptyState icon="cash-outline" title="No earnings data" />
          ) : (
            earnings.map((item: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={s.memberName}>{item.cleaner_name || item.name || `Cleaner ${i + 1}`}</Text>
                    <Text style={s.sub}>{item.jobs_completed ?? item.jobsCompleted ?? 0} jobs</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: Theme.success }}>${item.total_earnings ?? item.revenue ?? 0}</Text>
                </View>
              </GlassCard>
            ))
          )
        )}
      </ScrollView>

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
              <Text style={[s.typeBtnText, cleanerForm.employee_type === "technician" && s.typeBtnTextActive]}>
                Technician
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCleanerForm((f) => ({ ...f, employee_type: "salesman" }))}
              style={[s.typeBtn, cleanerForm.employee_type === "salesman" && s.typeBtnActive]}
            >
              <Text style={[s.typeBtnText, cleanerForm.employee_type === "salesman" && s.typeBtnTextActive]}>
                Salesman
              </Text>
            </TouchableOpacity>
          </View>

          <ToggleField
            label="Team Lead"
            value={cleanerForm.is_team_lead}
            onValueChange={(v: boolean) => setCleanerForm((f) => ({ ...f, is_team_lead: v }))}
          />

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton
              title={editingCleaner ? "Save Changes" : "Create Cleaner"}
              onPress={handleSaveCleaner}
              variant="primary"
              loading={isSaving}
            />
            {editingCleaner && (
              <ActionButton
                title="Delete Cleaner"
                onPress={handleDeleteCleaner}
                variant="destructive"
                loading={deleteCleanerMutation.isPending}
              />
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
                <Text style={[s.leadOptionText, String(c.id) === teamForm.lead_id && s.leadOptionTextActive]}>
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  tabBar: { flexDirection: "row", marginHorizontal: 16, marginTop: 8, marginBottom: 12, borderRadius: 8, backgroundColor: Theme.muted, padding: 4 },
  tab: { flex: 1, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  tabActive: { backgroundColor: Theme.card },
  tabText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  teamHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  teamIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  memberName: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  sub: { fontSize: 12, color: Theme.mutedForeground, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500" },
  roleText: { fontSize: 11, color: Theme.mutedForeground, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: Theme.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  credBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: Theme.border },
  credBtnText: { fontSize: 11, fontWeight: "500", color: Theme.mutedForeground },
  manageActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  manageBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Theme.primary, paddingVertical: 12, borderRadius: 10 },
  manageBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  deleteTeamBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.destructiveBg },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: Theme.mutedForeground, marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, alignItems: "center" },
  typeBtnActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.1)" },
  typeBtnText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  typeBtnTextActive: { color: Theme.primary },
  leadOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: Theme.border },
  leadOptionActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.1)" },
  leadOptionText: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  leadOptionTextActive: { color: Theme.primary },
});
