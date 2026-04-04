import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchJobs, apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

export default function RainDayScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["jobs", selectedDate, "rain-day"],
    queryFn: () => fetchJobs({ date: selectedDate }),
  });

  const jobs: Job[] = (data as any)?.data ?? (data as any)?.jobs ?? [];
  const outdoorJobs = jobs.filter(
    (j) =>
      j.service_type?.includes("window") ||
      j.service_type?.includes("pressure") ||
      j.service_type?.includes("gutter") ||
      j.status !== "completed"
  );

  const rescheduleMutation = useMutation({
    mutationFn: (jobIds: string[]) =>
      apiFetch("/api/actions/auto-schedule", {
        method: "POST",
        body: JSON.stringify({ jobIds, reason: "rain_day" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      Alert.alert("Success", "Jobs rescheduled");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleBulkReschedule = () => {
    const jobIds = outdoorJobs.map((j) => j.id).filter(Boolean);
    if (jobIds.length === 0) {
      Alert.alert("No jobs", "No outdoor jobs to reschedule");
      return;
    }
    Alert.alert(
      "Reschedule Jobs",
      `Reschedule ${jobIds.length} outdoor job(s) due to rain?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reschedule", onPress: () => rescheduleMutation.mutate(jobIds) },
      ]
    );
  };

  if (isLoading) return <LoadingScreen message="Loading..." />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={{ [selectedDate]: { selected: true, selectedColor: Theme.primary } }}
        theme={{
          backgroundColor: Theme.background,
          calendarBackground: Theme.background,
          selectedDayBackgroundColor: Theme.primary,
          todayTextColor: Theme.primary,
          dayTextColor: Theme.foreground,
          textDisabledColor: Theme.zinc600,
          monthTextColor: Theme.foreground,
          arrowColor: Theme.primary,
        }}
      />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="rainy" size={24} color={Theme.mutedForeground} />
            <Text style={styles.headerTitle}>Rain Day Tool</Text>
          </View>
          <Badge label={`${outdoorJobs.length} jobs`} variant="warning" />
        </View>

        <Button
          title={`Reschedule ${outdoorJobs.length} Outdoor Jobs`}
          onPress={handleBulkReschedule}
          loading={rescheduleMutation.isPending}
          disabled={outdoorJobs.length === 0}
        />

        <View style={styles.jobList}>
          {outdoorJobs.map((job, i) => (
            <GlassCard key={job.id || i} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {job.customer_name || job.phone_number || "Job"}
                  </Text>
                  <Text style={styles.subText}>
                    {job.service_type} {"\u2022"} {job.scheduled_time || ""}
                  </Text>
                </View>
                <Badge label={job.status || "scheduled"} variant="default" />
              </View>
            </GlassCard>
          ))}
        </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
  },
  jobList: {
    marginTop: 16,
  },
  card: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
});
