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
import { Theme } from "@/constants/colors";

type Tab = "teams" | "manage" | "messages" | "earnings";

export default function TeamsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const queryClient = useQueryClient();

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

  if (teamsQuery.isLoading) return <LoadingScreen message="Loading teams..." />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "teams", label: "Teams" },
    { key: "manage", label: "Manage" },
    { key: "messages", label: "Messages" },
    { key: "earnings", label: "Earnings" },
  ];

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
            {manageQuery.isLoading ? (
              <LoadingScreen message="Loading..." />
            ) : allCleaners.length === 0 ? (
              <EmptyState icon="people-outline" title="No cleaners" />
            ) : (
              allCleaners.map((cleaner: any, i: number) => (
                <GlassCard key={cleaner.id || i} style={{ marginBottom: 8 }}>
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
                        onPress={() => cleaner.id && credentialsMutation.mutate(Number(cleaner.id))}
                        style={s.credBtn}
                      >
                        <Text style={s.credBtnText}>Send Credentials</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
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
});
