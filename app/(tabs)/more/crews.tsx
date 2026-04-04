import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchCrews, fetchTeams, saveCrews } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
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
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={crewsQuery.isRefetching} onRefresh={() => crewsQuery.refetch()} />}
    >
      <View className="p-4">
        {/* Date Nav */}
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigateDate(-1)}>
            <Ionicons name="chevron-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-dark-900 dark:text-white">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "short", day: "numeric",
            })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate(1)}>
            <Ionicons name="chevron-forward" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* Available Cleaners */}
        <Text className="mb-2 text-sm font-medium uppercase text-dark-500 dark:text-dark-400">
          Available Cleaners
        </Text>
        {cleaners.length === 0 ? (
          <Card className="mb-4">
            <Text className="text-center text-dark-400">No cleaners available</Text>
          </Card>
        ) : (
          <View className="mb-4 flex-row flex-wrap gap-2">
            {cleaners.filter(c => c.active).map((cleaner, i) => (
              <View
                key={cleaner.id || i}
                className="rounded-lg bg-white px-3 py-2 dark:bg-dark-800"
              >
                <Text className="text-sm font-medium text-dark-900 dark:text-white">
                  {cleaner.name}
                </Text>
                <Text className="text-xs text-dark-400">
                  {cleaner.is_team_lead ? "Lead" : cleaner.employee_type || "Tech"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Crew Assignments */}
        <Text className="mb-2 text-sm font-medium uppercase text-dark-500 dark:text-dark-400">
          Crew Assignments
        </Text>
        {crewDays.length === 0 ? (
          <EmptyState
            icon="construct-outline"
            title="No crews assigned"
            description="Assign crews for this day"
          />
        ) : (
          crewDays.map((day, i) =>
            day.assignments.map((assignment, j) => (
              <Card key={`${i}-${j}`} className="mb-2">
                <View className="flex-row items-center">
                  <Ionicons name="people" size={20} color="#8b5cf6" />
                  <Text className="ml-2 font-medium text-dark-900 dark:text-white">
                    {assignment.team_lead_name || `Team Lead #${assignment.team_lead_id}`}
                  </Text>
                  <Badge label="Lead" variant="warning" />
                </View>
                {assignment.members.map((member, k) => (
                  <View key={k} className="ml-7 mt-1 flex-row items-center">
                    <Ionicons name="person-outline" size={14} color="#94a3b8" />
                    <Text className="ml-2 text-sm text-dark-700 dark:text-dark-300">
                      {member.name || `Cleaner #${member.cleaner_id}`}
                    </Text>
                    <Text className="ml-2 text-xs text-dark-400">{member.role}</Text>
                  </View>
                ))}
              </Card>
            ))
          )
        )}
      </View>
    </ScrollView>
  );
}
