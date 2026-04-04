import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchCrews, fetchTeams, saveCrews } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";
import { Cleaner, CrewDay } from "@/types";

export default function CrewsScreen() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const queryClient = useQueryClient();

  const crewsQuery = useQuery({
    queryKey: ["crews", date],
    queryFn: () => fetchCrews(date),
  });

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const crewDays: CrewDay[] = (crewsQuery.data as any)?.crewDays ?? [];
  const cleaners: Cleaner[] = (teamsQuery.data as any)?.cleaners ?? (teamsQuery.data as any)?.data ?? [];

  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  };

  if (crewsQuery.isLoading) return <LoadingScreen message="Loading crews..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={crewsQuery.isRefetching} onRefresh={() => crewsQuery.refetch()} tintColor={Theme.primary} />}
    >
      <View style={styles.content}>
        {/* Date Nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateDate(-1)}>
            <Ionicons name="chevron-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "short", day: "numeric",
            })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate(1)}>
            <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Available Cleaners */}
        <Text style={styles.sectionLabel}>Available Cleaners</Text>
        {cleaners.length === 0 ? (
          <GlassCard style={styles.cardSpacing}>
            <Text style={styles.emptyText}>No cleaners available</Text>
          </GlassCard>
        ) : (
          <View style={styles.cleanerChips}>
            {cleaners.filter(c => c.active).map((cleaner, i) => (
              <View key={cleaner.id || i} style={styles.cleanerChip}>
                <Text style={styles.cleanerChipName}>{cleaner.name}</Text>
                <Text style={styles.cleanerChipRole}>
                  {cleaner.is_team_lead ? "Lead" : cleaner.employee_type || "Tech"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Crew Assignments */}
        <Text style={styles.sectionLabel}>Crew Assignments</Text>
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
                    {assignment.team_lead_name || `Team Lead #${assignment.team_lead_id}`}
                  </Text>
                  <Badge label="Lead" variant="warning" />
                </View>
                {assignment.members.map((member, k) => (
                  <View key={k} style={styles.memberRow}>
                    <Ionicons name="person-outline" size={14} color={Theme.mutedForeground} />
                    <Text style={styles.memberName}>
                      {member.name || `Cleaner #${member.cleaner_id}`}
                    </Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                ))}
              </GlassCard>
            ))
          )
        )}
      </View>
    </ScrollView>
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
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    color: Theme.mutedForeground,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: Theme.zinc400,
  },
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
  },
  cleanerChipName: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  cleanerChipRole: {
    fontSize: 11,
    color: Theme.zinc400,
  },
  cardSpacing: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  leadName: {
    marginLeft: 8,
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
  },
  memberRow: {
    marginLeft: 28,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  memberName: {
    marginLeft: 8,
    fontSize: 13,
    color: Theme.foreground,
    opacity: 0.8,
  },
  memberRole: {
    marginLeft: 8,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
