import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchJobs, apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Job } from "@/types";
import { useColorScheme } from "react-native";

export default function RainDayScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={{ [selectedDate]: { selected: true, selectedColor: "#3b82f6" } }}
        theme={{
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          calendarBackground: isDark ? "#0f172a" : "#ffffff",
          selectedDayBackgroundColor: "#3b82f6",
          todayTextColor: "#3b82f6",
          dayTextColor: isDark ? "#f8fafc" : "#0f172a",
          textDisabledColor: isDark ? "#334155" : "#cbd5e1",
          monthTextColor: isDark ? "#f8fafc" : "#0f172a",
          arrowColor: "#3b82f6",
        }}
      />

      <View className="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="rainy" size={24} color="#64748b" />
            <Text className="ml-2 text-lg font-semibold text-dark-900 dark:text-white">
              Rain Day Tool
            </Text>
          </View>
          <Badge label={`${outdoorJobs.length} jobs`} variant="warning" />
        </View>

        <Button
          title={`Reschedule ${outdoorJobs.length} Outdoor Jobs`}
          onPress={handleBulkReschedule}
          loading={rescheduleMutation.isPending}
          disabled={outdoorJobs.length === 0}
        />

        <View className="mt-4">
          {outdoorJobs.map((job, i) => (
            <Card key={job.id || i} className="mb-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    {job.customer_name || job.phone_number || "Job"}
                  </Text>
                  <Text className="text-sm text-dark-500 dark:text-dark-400">
                    {job.service_type} • {job.scheduled_time || ""}
                  </Text>
                </View>
                <Badge label={job.status || "scheduled"} variant="default" />
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
