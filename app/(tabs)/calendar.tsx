import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchJobs, completeJob, assignCleaner } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Job } from "@/types";
import { useColorScheme } from "react-native";

export default function CalendarScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
      selectedColor: "#3b82f6",
    },
  };

  // Mark dates with jobs
  jobs.forEach((job) => {
    const d = job.date || job.scheduled_date;
    if (d && d !== selectedDate) {
      markedDates[d] = { marked: true, dotColor: "#3b82f6" };
    }
  });

  return (
    <ScrollView
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
      }
    >
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          calendarBackground: isDark ? "#0f172a" : "#ffffff",
          textSectionTitleColor: isDark ? "#94a3b8" : "#64748b",
          selectedDayBackgroundColor: "#3b82f6",
          selectedDayTextColor: "#ffffff",
          todayTextColor: "#3b82f6",
          dayTextColor: isDark ? "#f8fafc" : "#0f172a",
          textDisabledColor: isDark ? "#334155" : "#cbd5e1",
          monthTextColor: isDark ? "#f8fafc" : "#0f172a",
          arrowColor: "#3b82f6",
        }}
      />

      <View className="p-4">
        <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
          Jobs for {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>

        {isLoading ? (
          <LoadingScreen message="Loading jobs..." />
        ) : jobs.length === 0 ? (
          <Card>
            <Text className="text-center text-dark-500 dark:text-dark-400">
              No jobs on this date
            </Text>
          </Card>
        ) : (
          jobs.map((job, i) => (
            <Card key={job.id || i} className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-dark-900 dark:text-white">
                    {job.customer_name || job.phone_number || "Unnamed"}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <Ionicons name="time-outline" size={14} color="#94a3b8" />
                    <Text className="ml-1 text-sm text-dark-500 dark:text-dark-400">
                      {job.scheduled_time || job.scheduled_at || "TBD"}
                    </Text>
                  </View>
                  {job.address && (
                    <View className="mt-1 flex-row items-center">
                      <Ionicons name="location-outline" size={14} color="#94a3b8" />
                      <Text className="ml-1 text-sm text-dark-500 dark:text-dark-400" numberOfLines={1}>
                        {job.address}
                      </Text>
                    </View>
                  )}
                  <View className="mt-1 flex-row items-center">
                    <Ionicons name="construct-outline" size={14} color="#94a3b8" />
                    <Text className="ml-1 text-sm text-dark-500 dark:text-dark-400">
                      {job.service_type || "Service"}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
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
                    <Text className="mt-1 text-sm font-semibold text-green-600 dark:text-green-400">
                      ${job.price}
                    </Text>
                  )}
                </View>
              </View>

              {job.status !== "completed" && job.status !== "cancelled" && (
                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1">
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
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
