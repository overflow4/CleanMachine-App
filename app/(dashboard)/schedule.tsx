import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Alert } from "react-native";
import { fetchMyJobs, fetchCrews, createJob } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

type ViewMode = "day" | "week";

interface JobForm {
  customer_name: string;
  phone_number: string;
  address: string;
  service_type: string;
  scheduled_date: string;
  scheduled_time: string;
}

const emptyJobForm: JobForm = {
  customer_name: "",
  phone_number: "",
  address: "",
  service_type: "",
  scheduled_date: new Date().toISOString().split("T")[0],
  scheduled_time: "09:00",
};

const SERVICE_TYPES = ["Standard Clean", "Deep Clean", "Move-In/Out", "Post-Construction", "Window Cleaning", "Carpet Cleaning"];

export default function ScheduleScreen() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobForm, setJobForm] = useState<JobForm>(emptyJobForm);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-jobs", date, viewMode],
    queryFn: () => fetchMyJobs(date, viewMode),
  });

  const crewsQuery = useQuery({
    queryKey: ["crews", date, viewMode],
    queryFn: () => fetchCrews(date, viewMode === "week"),
  });

  const createJobMutation = useMutation({
    mutationFn: (formData: JobForm) =>
      createJob({
        customer_name: formData.customer_name,
        phone_number: formData.phone_number,
        address: formData.address,
        service_type: formData.service_type,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
      } as Partial<Job>),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      setShowCreateModal(false);
      setJobForm(emptyJobForm);
      Alert.alert("Success", "Job created successfully");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const jobs: Job[] = (data as any)?.jobs ?? [];
  const dateRange = (data as any)?.dateRange;

  const navigateDate = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + (viewMode === "week" ? 7 * dir : dir));
    setDate(d.toISOString().split("T")[0]);
  };

  const handleCreateJob = () => {
    if (!jobForm.customer_name.trim()) {
      Alert.alert("Validation", "Customer name is required");
      return;
    }
    if (!jobForm.phone_number.trim()) {
      Alert.alert("Validation", "Phone number is required");
      return;
    }
    if (!jobForm.address.trim()) {
      Alert.alert("Validation", "Address is required");
      return;
    }
    if (!jobForm.service_type) {
      Alert.alert("Validation", "Service type is required");
      return;
    }
    createJobMutation.mutate(jobForm);
  };

  const openCreateModal = () => {
    setJobForm({ ...emptyJobForm, scheduled_date: date });
    setShowCreateModal(true);
  };

  if (isLoading) return <LoadingScreen message="Loading schedule..." />;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      >
        <View style={styles.content}>
          {/* View Mode Toggle */}
          <View style={styles.tabBar}>
            {(["day", "week"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[styles.tab, viewMode === mode && styles.tabActive]}
              >
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Nav */}
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => navigateDate(-1)}>
              <Ionicons name="chevron-back" size={24} color={Theme.primary} />
            </TouchableOpacity>
            <Text style={styles.dateLabel}>
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric",
              })}
              {dateRange?.end && ` \u2014 ${new Date(dateRange.end + "T12:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              })}`}
            </Text>
            <TouchableOpacity onPress={() => navigateDate(1)}>
              <Ionicons name="chevron-forward" size={24} color={Theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Jobs */}
          {jobs.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No jobs scheduled" description="No jobs for this period" />
          ) : (
            jobs.map((job, i) => (
              <GlassCard key={job.id || i} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nameText}>
                      {job.customer_name || job.phone_number || "Job"}
                    </Text>
                    <Text style={styles.subText}>
                      {job.scheduled_time || job.scheduled_at || ""} {"\u2022"} {job.service_type || "Service"}
                    </Text>
                    {job.address && (
                      <Text style={styles.addressText} numberOfLines={1}>{job.address}</Text>
                    )}
                  </View>
                  <Badge
                    label={job.status || "scheduled"}
                    variant={job.status === "completed" ? "success" : job.status === "cancelled" ? "error" : "default"}
                  />
                </View>
                {job.price != null && (
                  <Text style={styles.priceText}>${job.price}</Text>
                )}
              </GlassCard>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openCreateModal}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Job Modal */}
      <Modal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setJobForm(emptyJobForm);
        }}
        title="Create Job"
      >
        <InputField
          label="Customer Name"
          value={jobForm.customer_name}
          onChangeText={(v: string) => setJobForm((f) => ({ ...f, customer_name: v }))}
          placeholder="Full name"
        />
        <InputField
          label="Phone Number"
          value={jobForm.phone_number}
          onChangeText={(v: string) => setJobForm((f) => ({ ...f, phone_number: v }))}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
        />
        <InputField
          label="Address"
          value={jobForm.address}
          onChangeText={(v: string) => setJobForm((f) => ({ ...f, address: v }))}
          placeholder="Street address"
        />

        <Text style={styles.fieldLabel}>Service Type</Text>
        <View style={styles.serviceGrid}>
          {SERVICE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setJobForm((f) => ({ ...f, service_type: type }))}
              style={[
                styles.serviceChip,
                jobForm.service_type === type && styles.serviceChipActive,
              ]}
            >
              <Text style={[
                styles.serviceChipText,
                jobForm.service_type === type && styles.serviceChipTextActive,
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <InputField
          label="Date"
          value={jobForm.scheduled_date}
          onChangeText={(v: string) => setJobForm((f) => ({ ...f, scheduled_date: v }))}
          placeholder="YYYY-MM-DD"
        />
        <InputField
          label="Time"
          value={jobForm.scheduled_time}
          onChangeText={(v: string) => setJobForm((f) => ({ ...f, scheduled_time: v }))}
          placeholder="HH:MM (e.g. 09:00)"
        />

        <View style={{ marginTop: 16 }}>
          <ActionButton
            title="Create Job"
            onPress={handleCreateJob}
            variant="primary"
            loading={createJobMutation.isPending}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: Theme.card,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
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
  card: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  addressText: {
    fontSize: 11,
    color: Theme.zinc400,
  },
  priceText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.success,
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: Theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  // Form styles
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
    marginBottom: 6,
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  serviceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
  },
  serviceChipActive: {
    borderColor: Theme.primary,
    backgroundColor: "rgba(0,145,255,0.1)",
  },
  serviceChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  serviceChipTextActive: {
    color: Theme.primary,
  },
});
