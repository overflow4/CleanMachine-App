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
import { Calendar, DateData } from "react-native-calendars";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchJobs, completeJob, assignCleaner } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["jobs", selectedDate],
    queryFn: () => fetchJobs({ date: selectedDate }),
  });

  const jobs: Job[] = (data as any)?.data ?? (data as any)?.jobs ?? [];

  const completeMutation = useMutation({
    mutationFn: (jobId: string) => completeJob(jobId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleCompleteJob = (job: Job) => {
    Alert.alert("Complete Job", `Mark "${job.customer_name || "this job"}" as completed?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: () => completeMutation.mutate(job.id),
      },
    ]);
  };

  const markedDates: Record<string, any> = {
    [selectedDate]: {
      selected: true,
      selectedColor: Theme.primary,
    },
  };

  jobs.forEach((job) => {
    const d = job.date || job.scheduled_date;
    if (d && d !== selectedDate) {
      markedDates[d] = { marked: true, dotColor: Theme.primary };
    }
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />
      }
    >
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: Theme.background,
          calendarBackground: Theme.background,
          textSectionTitleColor: Theme.mutedForeground,
          selectedDayBackgroundColor: Theme.primary,
          selectedDayTextColor: "#ffffff",
          todayTextColor: Theme.primary,
          dayTextColor: Theme.foreground,
          textDisabledColor: Theme.zinc600,
          monthTextColor: Theme.foreground,
          arrowColor: Theme.primary,
        }}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Jobs for {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>

        {isLoading ? (
          <LoadingScreen message="Loading jobs..." />
        ) : jobs.length === 0 ? (
          <GlassCard>
            <Text style={styles.emptyText}>No jobs on this date</Text>
          </GlassCard>
        ) : (
          jobs.map((job, i) => (
            <GlassCard key={job.id || i} style={styles.jobCard}>
              <View style={styles.jobRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobName}>
                    {job.customer_name || job.phone_number || "Unnamed"}
                  </Text>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={14} color={Theme.mutedForeground} />
                    <Text style={styles.detailText}>
                      {job.scheduled_time || job.scheduled_at || "TBD"}
                    </Text>
                  </View>
                  {job.address && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={14} color={Theme.mutedForeground} />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {job.address}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="construct-outline" size={14} color={Theme.mutedForeground} />
                    <Text style={styles.detailText}>
                      {job.service_type || "Service"}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Badge
                    label={job.status || "scheduled"}
                    variant={
                      job.status === "completed"
                        ? "success"
                        : job.status === "cancelled"
                        ? "error"
                        : job.status === "in_progress" || job.status === "in-progress"
                        ? "info"
                        : "default"
                    }
                  />
                  {job.price != null && (
                    <Text style={styles.priceText}>${job.price}</Text>
                  )}
                </View>
              </View>

              {job.status !== "completed" && job.status !== "cancelled" && (
                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Complete"
                      variant="primary"
                      size="sm"
                      onPress={() => handleCompleteJob(job)}
                      loading={completeMutation.isPending}
                    />
                  </View>
                </View>
              )}
            </GlassCard>
          ))
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    color: Theme.mutedForeground,
  },
  jobCard: {
    marginBottom: 12,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  jobName: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  detailText: {
    marginLeft: 4,
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  priceText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.success,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
});
