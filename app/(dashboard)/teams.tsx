import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchTeams, fetchTeamMessages, fetchTeamEarnings, manageTeam, sendEmployeeCredentials } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { Cleaner } from "@/types";

type Tab = "members" | "messages" | "earnings";

export default function TeamsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
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

  const teamsData: any = teamsQuery.data;
  const cleaners: Cleaner[] = teamsData?.cleaners ?? teamsData?.data ?? [];
  const messages: any[] = (messagesQuery.data as any)?.messages ?? (messagesQuery.data as any)?.data ?? [];
  const earnings: any[] = (earningsQuery.data as any)?.earnings ?? (earningsQuery.data as any)?.data ?? [];

  const onRefresh = useCallback(async () => {
    await Promise.all([
      teamsQuery.refetch(),
      activeTab === "messages" ? messagesQuery.refetch() : Promise.resolve(),
      activeTab === "earnings" ? earningsQuery.refetch() : Promise.resolve(),
    ]);
  }, [activeTab]);

  if (teamsQuery.isLoading && !cleaners.length) {
    return <LoadingScreen message="Loading teams..." />;
  }

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "members", label: "Members", icon: "people-outline" },
    { key: "messages", label: "Messages", icon: "chatbubbles-outline" },
    { key: "earnings", label: "Earnings", icon: "cash-outline" },
  ];

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={teamsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />
        }
      >
        {activeTab === "members" && (
          <View style={styles.listPadding}>
            {cleaners.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No team members"
                description="Team members will appear here"
              />
            ) : (
              cleaners.map((cleaner, i) => (
                <GlassCard key={cleaner.id || i} style={styles.cardSpacing}>
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {cleaner.name?.[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.nameText}>{cleaner.name}</Text>
                      <Text style={styles.subText}>{cleaner.phone || "No phone"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {cleaner.employee_type && (
                        <Badge
                          label={cleaner.employee_type}
                          variant={cleaner.employee_type === "salesman" ? "info" : "default"}
                        />
                      )}
                      {cleaner.is_team_lead && (
                        <Badge label="Team Lead" variant="warning" />
                      )}
                    </View>
                  </View>
                  <View style={styles.actionEnd}>
                    <Button
                      title="Send Credentials"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        if (cleaner.id) {
                          credentialsMutation.mutate(Number(cleaner.id));
                        }
                      }}
                      loading={credentialsMutation.isPending}
                    />
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        {activeTab === "messages" && (
          <View style={styles.listPadding}>
            {messages.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No messages"
                description="Team messages will appear here"
              />
            ) : (
              messages.map((msg, i) => (
                <GlassCard key={i} style={styles.cardSpacing}>
                  <View style={styles.rowStart}>
                    <Ionicons name="chatbubble-outline" size={16} color={Theme.mutedForeground} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.nameText}>
                        {msg.sender_name || msg.cleaner_name || "Unknown"}
                      </Text>
                      <Text style={styles.bodyText}>
                        {msg.content || msg.message || ""}
                      </Text>
                      <Text style={styles.timestampText}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        {activeTab === "earnings" && (
          <View style={styles.listPadding}>
            {earnings.length === 0 ? (
              <EmptyState
                icon="cash-outline"
                title="No earnings data"
                description="Earnings will appear here"
              />
            ) : (
              earnings.map((item, i) => (
                <GlassCard key={i} style={styles.cardSpacing}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.nameText}>
                        {item.cleaner_name || item.name || `Cleaner ${i + 1}`}
                      </Text>
                      <Text style={styles.subText}>
                        {item.jobs_completed ?? 0} jobs
                      </Text>
                    </View>
                    <Text style={styles.earningsValue}>
                      ${item.total_earnings ?? item.revenue ?? 0}
                    </Text>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: Theme.card,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
  },
  listPadding: {
    paddingHorizontal: 16,
  },
  cardSpacing: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "600",
    color: Theme.primaryLight,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  bodyText: {
    fontSize: 13,
    color: Theme.foreground,
    opacity: 0.8,
  },
  timestampText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
  actionEnd: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.success,
  },
});
