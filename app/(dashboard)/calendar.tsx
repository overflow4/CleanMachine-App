import React, { useState, useCallback, useMemo } from "react";
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
import { fetchJobs, completeJob, createJob, updateJob, deleteJob, assignCleaner } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

const SERVICE_TYPES = [
  { label: "Window Cleaning", value: "window_cleaning" },
  { label: "Pressure Washing", value: "pressure_washing" },
  { label: "Gutter Cleaning", value: "gutter_cleaning" },
  { label: "Full Service", value: "full_service" },
];

const ASSIGNMENT_MODES = [
  { label: "Auto", value: "auto" },
  { label: "Ranked", value: "ranked" },
  { label: "Broadcast", value: "broadcast" },
  { label: "Unassigned", value: "unassigned" },
];

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  address: "",
  service_type: "window_cleaning",
  date: "",
  scheduled_time: "",
  duration_minutes: "",
  price: "",
  notes: "",
  assignment_mode: "auto",
};

type FormData = typeof EMPTY_FORM;

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["jobs", selectedDate],
    queryFn: () => fetchJobs({ date: selectedDate }),
  });

  const jobs: Job[] = (data as any)?.data ?? (data as any)?.jobs ?? [];

  // --- Mutations ---

  const completeMutation = useMutation({
    mutationFn: (jobId: string) => completeJob(jobId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => createJob(data),
    onMutate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      updateJob(id, data),
    onMutate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onMutate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // --- Handlers ---

  const handleCompleteJob = (job: Job) => {
    Alert.alert("Complete Job", `Mark "${job.customer_name || "this job"}" as completed?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: () => completeMutation.mutate(job.id),
      },
    ]);
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setModalVisible(true);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setForm({
      customer_name: job.customer_name || "",
      customer_phone: job.customer_phone || job.phone_number || "",
      address: job.address || "",
      service_type: job.service_type || "window_cleaning",
      date: job.date || job.scheduled_date || selectedDate,
      scheduled_time: job.scheduled_time || job.scheduled_at || "",
      duration_minutes: job.duration_minutes != null ? String(job.duration_minutes) : "",
      price: job.price != null ? String(job.price) : job.estimated_value != null ? String(job.estimated_value) : "",
      notes: job.notes || "",
      assignment_mode: "auto",
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingJob(null);
    setForm({ ...EMPTY_FORM });
  };

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.date) {
      Alert.alert("Validation", "Please provide a date.");
      return;
    }

    const payload: Record<string, any> = {
      customer_name: form.customer_name || undefined,
      customer_phone: form.customer_phone || undefined,
      address: form.address || undefined,
      service_type: form.service_type,
      date: form.date,
      scheduled_date: form.date,
      scheduled_time: form.scheduled_time || undefined,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      notes: form.notes || undefined,
    };

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, assignment_mode: form.assignment_mode });
    }
  };

  const handleDelete = () => {
    if (!editingJob) return;
    Alert.alert(
      "Delete Job",
      `Are you sure you want to delete "${editingJob.customer_name || "this job"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(editingJob.id),
        },
      ]
    );
  };

  // --- Calendar marks ---

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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // --- Picker helper ---

  const PickerRow = ({
    label,
    options,
    value,
    onSelect,
  }: {
    label: string;
    options: { label: string; value: string }[];
    value: string;
    onSelect: (v: string) => void;
  }) => (
    <View>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerRow}
      >
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.pickerChip,
              value === opt.value && styles.pickerChipActive,
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.pickerChipText,
                value === opt.value && styles.pickerChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Jobs for{" "}
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <LoadingScreen message="Loading jobs..." />
          ) : jobs.length === 0 ? (
            <GlassCard>
              <Text style={styles.emptyText}>No jobs on this date</Text>
            </GlassCard>
          ) : (
            jobs.map((job, i) => (
              <TouchableOpacity
                key={job.id || i}
                activeOpacity={0.7}
                onPress={() => openEditModal(job)}
              >
                <GlassCard style={styles.jobCard}>
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
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB for creating a job */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create / Edit Job Modal */}
      <Modal
        visible={modalVisible}
        onClose={closeModal}
        title={editingJob ? "Edit Job" : "Create Job"}
      >
        <InputField
          label="Customer Name"
          value={form.customer_name}
          onChangeText={(v) => updateField("customer_name", v)}
          placeholder="John Smith"
        />

        <InputField
          label="Phone Number"
          value={form.customer_phone}
          onChangeText={(v) => updateField("customer_phone", v)}
          placeholder="+1 555-0123"
          keyboardType="phone-pad"
        />

        <InputField
          label="Address"
          value={form.address}
          onChangeText={(v) => updateField("address", v)}
          placeholder="123 Main St"
        />

        <PickerRow
          label="Service Type"
          options={SERVICE_TYPES}
          value={form.service_type}
          onSelect={(v) => updateField("service_type", v)}
        />

        <InputField
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={(v) => updateField("date", v)}
          placeholder="2026-04-03"
        />

        <InputField
          label="Time"
          value={form.scheduled_time}
          onChangeText={(v) => updateField("scheduled_time", v)}
          placeholder="09:00 AM"
        />

        <InputField
          label="Duration (minutes)"
          value={form.duration_minutes}
          onChangeText={(v) => updateField("duration_minutes", v)}
          placeholder="60"
          keyboardType="numeric"
        />

        <InputField
          label="Price ($)"
          value={form.price}
          onChangeText={(v) => updateField("price", v)}
          placeholder="150.00"
          keyboardType="decimal-pad"
        />

        <InputField
          label="Notes"
          value={form.notes}
          onChangeText={(v) => updateField("notes", v)}
          placeholder="Any special instructions..."
          multiline
          numberOfLines={3}
          style={{ minHeight: 72, textAlignVertical: "top" }}
        />

        {!editingJob && (
          <PickerRow
            label="Assignment Mode"
            options={ASSIGNMENT_MODES}
            value={form.assignment_mode}
            onSelect={(v) => updateField("assignment_mode", v)}
          />
        )}

        <View style={styles.modalActions}>
          <ActionButton
            title={editingJob ? "Save Changes" : "Create Job"}
            onPress={handleSave}
            loading={isSaving}
          />

          {editingJob && (
            <ActionButton
              title="Delete Job"
              variant="danger"
              onPress={handleDelete}
              loading={deleteMutation.isPending}
            />
          )}

          <ActionButton title="Cancel" variant="outline" onPress={closeModal} />
        </View>
      </Modal>
    </View>
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    flex: 1,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
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
    shadowColor: Theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
  },
  pickerChipActive: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  pickerChipText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  pickerChipTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  modalActions: {
    marginTop: 8,
    gap: 10,
  },
});
