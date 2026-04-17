import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchJobs,
  completeJob,
  createJob,
  updateJob,
  deleteJob,
  assignCleaner,
  recurringAction,
  generatePaymentLink,
  sendInvoice,
  autoSchedule,
  notifyCleaners,
  fetchTeams,
  placesAutocomplete,
  estimatePrice,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Job, Cleaner } from "@/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

type ViewMode = "day" | "week" | "month";

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

const STATUS_COLORS: Record<string, string> = {
  completed: Theme.success,
  cancelled: Theme.destructive,
  in_progress: Theme.primary,
  "in-progress": Theme.primary,
  confirmed: Theme.emerald400,
  assigned: Theme.violet400,
  scheduled: Theme.zinc500,
  lead: Theme.amber400,
  quoted: Theme.cyan400,
  rescheduled: Theme.warning,
};

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
  bedrooms: "",
  bathrooms: "",
  sqft: "",
};

type FormData = typeof EMPTY_FORM;

// Helpers
function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(start.getDate() - day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    dates.push(dt.toISOString().split("T")[0]);
  }
  return dates;
}

function getMonthDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const dates: string[] = [];
  for (let i = first.getDate(); i <= last.getDate(); i++) {
    const dt = new Date(year, month, i);
    dates.push(dt.toISOString().split("T")[0]);
  }
  return dates;
}

function formatShortDay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

function formatDayHeader(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function jobsOverlap(a: Job, b: Job): boolean {
  const aTime = a.scheduled_time || a.scheduled_at || "";
  const bTime = b.scheduled_time || b.scheduled_at || "";
  if (!aTime || !bTime) return false;
  const aDur = a.duration_minutes || 60;
  const bDur = b.duration_minutes || 60;
  const aStart = parseTimeToMinutes(aTime);
  const bStart = parseTimeToMinutes(bTime);
  if (aStart < 0 || bStart < 0) return false;
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

function parseTimeToMinutes(t: string): number {
  // handle "09:00 AM", "14:30", "2:00 PM"
  const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return -1;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  }
  return h * 60 + m;
}

function getStatusColor(status?: string): string {
  return STATUS_COLORS[status || "scheduled"] || Theme.zinc500;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price estimate
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimatingPrice, setEstimatingPrice] = useState(false);

  // Cleaners for assignment
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    enabled: modalVisible,
  });
  const cleaners: Cleaner[] =
    (teamsQuery.data as any)?.data?.cleaners ??
    (teamsQuery.data as any)?.cleaners ??
    (teamsQuery.data as any)?.data ??
    [];

  // Fetch jobs for selected date (day mode) or week range
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["jobs", selectedDate],
    queryFn: () => fetchJobs({ date: selectedDate }),
  });

  const weekQuery = useQuery({
    queryKey: ["jobs-week", weekDates[0], weekDates[6]],
    queryFn: () =>
      fetchJobs({ start_date: weekDates[0], end_date: weekDates[6] }),
    enabled: viewMode === "week",
  });

  const monthDates = useMemo(() => getMonthDates(selectedDate), [selectedDate]);
  const monthQuery = useQuery({
    queryKey: ["jobs-month", monthDates[0], monthDates[monthDates.length - 1]],
    queryFn: () =>
      fetchJobs({
        start_date: monthDates[0],
        end_date: monthDates[monthDates.length - 1],
      }),
    enabled: viewMode === "month",
  });

  const jobs: Job[] = (data as any)?.data ?? (data as any)?.jobs ?? [];
  const weekJobs: Job[] =
    (weekQuery.data as any)?.data ??
    (weekQuery.data as any)?.jobs ??
    [];
  const monthJobs: Job[] =
    (monthQuery.data as any)?.data ??
    (monthQuery.data as any)?.jobs ??
    [];

  // Group jobs by date for week/month views
  const jobsByDate = useMemo(() => {
    const source = viewMode === "week" ? weekJobs : viewMode === "month" ? monthJobs : jobs;
    const map: Record<string, Job[]> = {};
    source.forEach((job) => {
      const d = job.date || job.scheduled_date || "";
      if (!map[d]) map[d] = [];
      map[d].push(job);
    });
    return map;
  }, [viewMode, weekJobs, monthJobs, jobs]);

  // Conflict detection
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const dayJobs = viewMode === "day" ? jobs : jobsByDate[selectedDate] || [];
    for (let i = 0; i < dayJobs.length; i++) {
      for (let j = i + 1; j < dayJobs.length; j++) {
        if (jobsOverlap(dayJobs[i], dayJobs[j])) {
          ids.add(dayJobs[i].id);
          ids.add(dayJobs[j].id);
        }
      }
    }
    return ids;
  }, [jobs, jobsByDate, selectedDate, viewMode]);

  // --- Mutations ---

  const completeMutation = useMutation({
    mutationFn: (jobId: string) => completeJob(jobId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-week"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-month"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => createJob(data),
    onMutate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-week"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-month"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      updateJob(id, data),
    onMutate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-week"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-month"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onMutate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-week"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-month"] });
      closeModal();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const recurringMutation = useMutation({
    mutationFn: ({ action, jobId }: { action: string; jobId: string }) =>
      recurringAction(action, { job_id: jobId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      Alert.alert("Success", "Recurring job updated.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const paymentLinkMutation = useMutation({
    mutationFn: (jobId: string) =>
      generatePaymentLink({
        customerId: editingJob?.customer_id || editingJob?.id || jobId,
        type: "deposit",
        jobId,
        sendSms: true,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Deposit link generated and sent.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: (jobId: string) => sendInvoice({ job_id: jobId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Invoice sent.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const autoScheduleMutation = useMutation({
    mutationFn: (jobId: string) => autoSchedule(jobId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      Alert.alert("Success", "Job auto-scheduled.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const notifyCleanersMutation = useMutation({
    mutationFn: ({ jobId, ids }: { jobId: string; ids: number[] }) =>
      notifyCleaners(jobId, ids),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Cleaners notified.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // --- Address autocomplete ---
  const handleAddressChange = (text: string) => {
    updateField("address", text);
    if (addressTimeout.current) clearTimeout(addressTimeout.current);
    if (text.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    addressTimeout.current = setTimeout(async () => {
      try {
        const res = await placesAutocomplete(text);
        const preds = (res as any)?.predictions ?? [];
        setAddressSuggestions(preds);
        setShowAddressSuggestions(preds.length > 0);
      } catch {
        setAddressSuggestions([]);
      }
    }, 400);
  };

  const selectAddress = (prediction: any) => {
    updateField("address", prediction.description || prediction.structured_formatting?.main_text || "");
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  // --- Price estimation ---
  const triggerEstimate = useCallback(async () => {
    const bedrooms = parseInt(form.bedrooms, 10);
    const bathrooms = parseInt(form.bathrooms, 10);
    const sqft = parseInt(form.sqft, 10);
    if (!bedrooms && !bathrooms && !sqft) return;
    setEstimatingPrice(true);
    try {
      const res = await estimatePrice({
        service_type: form.service_type,
        bedrooms: bedrooms || undefined,
        bathrooms: bathrooms || undefined,
        sqft: sqft || undefined,
      });
      const est = (res as any)?.estimated_price ?? (res as any)?.price ?? (res as any)?.total ?? null;
      setEstimatedPrice(typeof est === "number" ? est : null);
    } catch {
      setEstimatedPrice(null);
    } finally {
      setEstimatingPrice(false);
    }
  }, [form.service_type, form.bedrooms, form.bathrooms, form.sqft]);

  useEffect(() => {
    if (!modalVisible) return;
    const timeout = setTimeout(() => triggerEstimate(), 600);
    return () => clearTimeout(timeout);
  }, [form.bedrooms, form.bathrooms, form.sqft, form.service_type, modalVisible, triggerEstimate]);

  // --- Handlers ---

  const handleCompleteJob = (job: Job) => {
    Alert.alert(
      "Complete Job",
      `Mark "${job.customer_name || "this job"}" as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: () => completeMutation.mutate(job.id) },
      ]
    );
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setEstimatedPrice(null);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
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
      duration_minutes:
        job.duration_minutes != null ? String(job.duration_minutes) : "",
      price:
        job.price != null
          ? String(job.price)
          : job.estimated_value != null
          ? String(job.estimated_value)
          : "",
      notes: job.notes || "",
      assignment_mode: "auto",
      bedrooms: "",
      bathrooms: "",
      sqft: "",
    });
    setEstimatedPrice(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingJob(null);
    setForm({ ...EMPTY_FORM });
    setEstimatedPrice(null);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
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
      duration_minutes: form.duration_minutes
        ? parseInt(form.duration_minutes, 10)
        : undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      notes: form.notes || undefined,
    };

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: payload });
    } else {
      createMutation.mutate({
        ...payload,
        assignment_mode: form.assignment_mode,
      });
    }
  };

  const handleDelete = () => {
    if (!editingJob) return;
    Alert.alert(
      "Delete Job",
      `Are you sure you want to delete "${
        editingJob.customer_name || "this job"
      }"? This cannot be undone.`,
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

  const handleRecurringAction = (
    action: string,
    label: string,
    needsConfirm: boolean
  ) => {
    if (!editingJob) return;
    if (needsConfirm) {
      Alert.alert(
        `${label}?`,
        `Are you sure you want to ${label.toLowerCase()} this recurring series? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: label,
            style: "destructive",
            onPress: () =>
              recurringMutation.mutate({ action, jobId: editingJob.id }),
          },
        ]
      );
    } else {
      recurringMutation.mutate({ action, jobId: editingJob.id });
    }
  };

  const handleAutoSchedule = () => {
    if (!editingJob) return;
    autoScheduleMutation.mutate(editingJob.id);
  };

  const handleNotifyCleaners = () => {
    if (!editingJob) return;
    const activeCleanerIds = cleaners
      .filter((c) => c.active && c.id)
      .map((c) => Number(c.id));
    if (activeCleanerIds.length === 0) {
      Alert.alert("No Cleaners", "No active cleaners to notify.");
      return;
    }
    notifyCleanersMutation.mutate({
      jobId: editingJob.id,
      ids: activeCleanerIds,
    });
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

  // --- View Mode Tabs ---
  const ViewModeTab = () => (
    <View style={styles.viewModeTabs}>
      {(["day", "week", "month"] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[
            styles.viewModeTab,
            viewMode === mode && styles.viewModeTabActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode(mode);
          }}
        >
          <Text
            style={[
              styles.viewModeTabText,
              viewMode === mode && styles.viewModeTabTextActive,
            ]}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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

  // --- Job Card (reusable) ---
  const renderJobCard = (job: Job, compact: boolean = false) => {
    const isConflict = conflictIds.has(job.id);
    const statusColor = getStatusColor(job.status);

    if (compact) {
      return (
        <TouchableOpacity
          key={job.id}
          style={[
            styles.compactJobCard,
            { borderLeftColor: statusColor },
            isConflict && styles.conflictCard,
          ]}
          activeOpacity={0.7}
          onPress={() => {
            setSelectedDate(job.date || job.scheduled_date || selectedDate);
            openEditModal(job);
          }}
        >
          <Text style={styles.compactJobName} numberOfLines={1}>
            {job.customer_name || job.phone_number || "Unnamed"}
          </Text>
          <Text style={styles.compactJobTime} numberOfLines={1}>
            {job.scheduled_time || job.scheduled_at || "TBD"}
          </Text>
          {job.price != null && (
            <Text style={styles.compactJobPrice}>${job.price}</Text>
          )}
          {job.membership_id && (
            <View style={styles.membershipBadge}>
              <Ionicons name="ribbon-outline" size={10} color={Theme.violet400} />
            </View>
          )}
          {isConflict && (
            <View style={styles.conflictIndicator}>
              <Ionicons name="warning" size={10} color={Theme.destructive} />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={job.id}
        activeOpacity={0.7}
        onPress={() => openEditModal(job)}
      >
        <GlassCard
          style={[
            styles.jobCard,
            isConflict && styles.conflictCard,
            { borderLeftWidth: 3, borderLeftColor: statusColor },
          ]}
        >
          <View style={styles.jobRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobName}>
                {job.customer_name || job.phone_number || "Unnamed"}
              </Text>
              <View style={styles.detailRow}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={Theme.mutedForeground}
                />
                <Text style={styles.detailText}>
                  {job.scheduled_time || job.scheduled_at || "TBD"}
                  {job.duration_minutes ? ` (${job.duration_minutes}m)` : ""}
                </Text>
              </View>
              {job.address && (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={Theme.mutedForeground}
                  />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {job.address}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons
                  name="construct-outline"
                  size={14}
                  color={Theme.mutedForeground}
                />
                <Text style={styles.detailText}>
                  {(job.service_type || "Service").replace(/_/g, " ")}
                </Text>
              </View>
              {job.cleaner_name && (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="person-outline"
                    size={14}
                    color={Theme.mutedForeground}
                  />
                  <Text style={styles.detailText}>{job.cleaner_name}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Badge
                label={job.status || "scheduled"}
                variant={
                  job.status === "completed"
                    ? "success"
                    : job.status === "cancelled"
                    ? "error"
                    : job.status === "in_progress" ||
                      job.status === "in-progress"
                    ? "info"
                    : "default"
                }
              />
              {job.price != null && (
                <Text style={styles.priceText}>${job.price}</Text>
              )}
              {job.membership_id && (
                <View style={styles.membershipTag}>
                  <Ionicons
                    name="ribbon-outline"
                    size={12}
                    color={Theme.violet400}
                  />
                  <Text style={styles.membershipTagText}>Member</Text>
                </View>
              )}
              {job.frequency && (
                <View style={styles.membershipTag}>
                  <Ionicons
                    name="repeat-outline"
                    size={12}
                    color={Theme.primary}
                  />
                  <Text style={[styles.membershipTagText, { color: Theme.primary }]}>
                    {job.frequency}
                  </Text>
                </View>
              )}
              {isConflict && (
                <View style={styles.conflictBadge}>
                  <Ionicons name="warning" size={12} color={Theme.destructive} />
                  <Text style={styles.conflictText}>Conflict</Text>
                </View>
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
    );
  };

  // --- Week View ---
  const renderWeekView = () => {
    const dayWidth = (SCREEN_WIDTH - 32) / 7;
    const today = new Date().toISOString().split("T")[0];
    return (
      <View style={styles.weekContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekGrid}>
            {/* Day headers */}
            <View style={styles.weekHeaderRow}>
              {weekDates.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.weekDayHeader,
                    { width: dayWidth },
                    d === selectedDate && styles.weekDayHeaderActive,
                    d === today && styles.weekDayHeaderToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(d);
                    setViewMode("day");
                  }}
                >
                  <Text style={styles.weekDayHeaderText}>
                    {formatDayHeader(d)}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayHeaderDate,
                      d === selectedDate && styles.weekDayHeaderDateActive,
                    ]}
                  >
                    {new Date(d + "T12:00:00").getDate()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Job columns */}
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.weekColumnsRow}>
                {weekDates.map((d) => {
                  const dayJobs = jobsByDate[d] || [];
                  return (
                    <View
                      key={d}
                      style={[styles.weekColumn, { width: dayWidth }]}
                    >
                      {dayJobs.length === 0 ? (
                        <Text style={styles.weekEmptyText}>--</Text>
                      ) : (
                        dayJobs.map((job) => renderJobCard(job, true))
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
        {weekQuery.isLoading && (
          <View style={styles.weekLoadingOverlay}>
            <ActivityIndicator size="small" color={Theme.primary} />
          </View>
        )}
      </View>
    );
  };

  // --- Month View ---
  const renderMonthView = () => {
    const today = new Date().toISOString().split("T")[0];
    const d = new Date(selectedDate + "T12:00:00");
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const cellWidth = (SCREEN_WIDTH - 32) / 7;

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    monthDates.forEach((dt) => cells.push(dt));

    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }

    return (
      <View style={styles.monthContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => {
              const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
              setSelectedDate(prev.toISOString().split("T")[0]);
            }}
          >
            <Ionicons name="chevron-back" size={20} color={Theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
              setSelectedDate(next.toISOString().split("T")[0]);
            }}
          >
            <Ionicons name="chevron-forward" size={20} color={Theme.primary} />
          </TouchableOpacity>
        </View>
        {/* Weekday labels */}
        <View style={styles.monthWeekdayRow}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
            <Text key={wd} style={[styles.monthWeekdayLabel, { width: cellWidth }]}>
              {wd}
            </Text>
          ))}
        </View>
        {/* Calendar grid */}
        {rows.map((row, ri) => (
          <View key={ri} style={styles.monthRow}>
            {row.map((cell, ci) => {
              if (!cell) {
                return <View key={ci} style={{ width: cellWidth, height: 52 }} />;
              }
              const dayJobs = jobsByDate[cell] || [];
              const isSelected = cell === selectedDate;
              const isToday = cell === today;
              return (
                <TouchableOpacity
                  key={cell}
                  style={[
                    styles.monthCell,
                    { width: cellWidth },
                    isSelected && styles.monthCellSelected,
                    isToday && styles.monthCellToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(cell);
                    setViewMode("day");
                  }}
                >
                  <Text
                    style={[
                      styles.monthCellDate,
                      isSelected && styles.monthCellDateSelected,
                    ]}
                  >
                    {new Date(cell + "T12:00:00").getDate()}
                  </Text>
                  {dayJobs.length > 0 && (
                    <View style={styles.monthJobCount}>
                      <Text style={styles.monthJobCountText}>
                        {dayJobs.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {monthQuery.isLoading && (
          <View style={styles.weekLoadingOverlay}>
            <ActivityIndicator size="small" color={Theme.primary} />
          </View>
        )}
      </View>
    );
  };

  // --- Day View ---
  const renderDayView = () => (
    <>
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
          jobs.map((job, i) => renderJobCard(job))
        )}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              if (viewMode === "week") weekQuery.refetch();
              if (viewMode === "month") monthQuery.refetch();
            }}
            tintColor={Theme.primary}
          />
        }
      >
        <ViewModeTab />

        {viewMode === "day" && renderDayView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "month" && renderMonthView()}

        {/* Show selected date jobs below week/month views */}
        {viewMode !== "day" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Jobs for{" "}
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "short", month: "short", day: "numeric" }
                )}
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={openCreateModal}
              >
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
              jobs.map((job) => renderJobCard(job))
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openCreateModal}
        activeOpacity={0.8}
      >
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
          onChangeText={(v: string) => updateField("customer_name", v)}
          placeholder="John Smith"
        />

        <InputField
          label="Phone Number"
          value={form.customer_phone}
          onChangeText={(v: string) => updateField("customer_phone", v)}
          placeholder="+1 555-0123"
          keyboardType="phone-pad"
        />

        {/* Address with autocomplete */}
        <View>
          <InputField
            label="Address"
            value={form.address}
            onChangeText={handleAddressChange}
            placeholder="Start typing an address..."
          />
          {showAddressSuggestions && (
            <View style={styles.suggestionsContainer}>
              {addressSuggestions.slice(0, 5).map((pred, i) => (
                <TouchableOpacity
                  key={pred.place_id || i}
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(pred)}
                >
                  <Ionicons
                    name="location"
                    size={14}
                    color={Theme.primary}
                  />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {pred.description ||
                      pred.structured_formatting?.main_text ||
                      ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <PickerRow
          label="Service Type"
          options={SERVICE_TYPES}
          value={form.service_type}
          onSelect={(v) => updateField("service_type", v)}
        />

        {/* Advanced pricing fields */}
        {!editingJob && (
          <View style={styles.pricingSection}>
            <Text style={styles.pricingSectionTitle}>
              <Ionicons name="calculator-outline" size={14} color={Theme.primary} />{" "}
              Estimate Price
            </Text>
            <View style={styles.pricingRow}>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Bedrooms"
                  value={form.bedrooms}
                  onChangeText={(v: string) => updateField("bedrooms", v)}
                  placeholder="3"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Bathrooms"
                  value={form.bathrooms}
                  onChangeText={(v: string) => updateField("bathrooms", v)}
                  placeholder="2"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Sqft"
                  value={form.sqft}
                  onChangeText={(v: string) => updateField("sqft", v)}
                  placeholder="2000"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {estimatingPrice && (
              <View style={styles.estimateRow}>
                <ActivityIndicator size="small" color={Theme.primary} />
                <Text style={styles.estimateText}>Estimating...</Text>
              </View>
            )}
            {estimatedPrice !== null && !estimatingPrice && (
              <TouchableOpacity
                style={styles.estimateRow}
                onPress={() => {
                  updateField("price", String(estimatedPrice));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name="pricetag"
                  size={14}
                  color={Theme.success}
                />
                <Text style={styles.estimateText}>
                  Estimated: ${estimatedPrice.toFixed(2)}
                </Text>
                <Text style={styles.estimateUseText}>Tap to use</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <InputField
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={(v: string) => updateField("date", v)}
          placeholder="2026-04-03"
        />

        <InputField
          label="Time"
          value={form.scheduled_time}
          onChangeText={(v: string) => updateField("scheduled_time", v)}
          placeholder="09:00 AM"
        />

        <InputField
          label="Duration (minutes)"
          value={form.duration_minutes}
          onChangeText={(v: string) => updateField("duration_minutes", v)}
          placeholder="60"
          keyboardType="numeric"
        />

        <InputField
          label="Price ($)"
          value={form.price}
          onChangeText={(v: string) => updateField("price", v)}
          placeholder="150.00"
          keyboardType="decimal-pad"
        />

        <InputField
          label="Notes"
          value={form.notes}
          onChangeText={(v: string) => updateField("notes", v)}
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

        {/* Auto-schedule & Notify */}
        {editingJob && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleAutoSchedule}
              disabled={autoScheduleMutation.isPending}
            >
              <Ionicons name="flash-outline" size={16} color={Theme.primary} />
              <Text style={styles.quickActionText}>
                {autoScheduleMutation.isPending ? "Scheduling..." : "Auto-Schedule"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleNotifyCleaners}
              disabled={notifyCleanersMutation.isPending}
            >
              <Ionicons
                name="notifications-outline"
                size={16}
                color={Theme.primary}
              />
              <Text style={styles.quickActionText}>
                {notifyCleanersMutation.isPending
                  ? "Notifying..."
                  : "Notify Cleaners"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => {
                if (!editingJob) return;
                Alert.alert("Add On-Site Charge", "Select charge type", [
                  { text: "Cancel", style: "cancel" },
                  ...["Pet Fee", "Fridge Cleaning", "Oven Cleaning", "Inside Cabinets", "Laundry", "Other"].map((type) => ({
                    text: type,
                    onPress: () => {
                      Alert.prompt?.(
                        `${type} Amount`,
                        "Enter charge amount in dollars",
                        async (amountStr: string) => {
                          try {
                            const { addCharge } = require("@/lib/api");
                            await addCharge({ job_id: String(editingJob.id), addon_type: type.toLowerCase().replace(/ /g, "_"), amount: parseFloat(amountStr) || undefined });
                            queryClient.invalidateQueries({ queryKey: ["jobs"] });
                            Alert.alert("Success", `${type} charge added`);
                          } catch (err: any) { Alert.alert("Error", err.message); }
                        },
                        "plain-text",
                        "",
                        "decimal-pad"
                      ) ?? Alert.alert("Add Charge", `${type} added to job`);
                    },
                  })),
                ]);
              }}
            >
              <Ionicons name="add-circle-outline" size={16} color={Theme.warning} />
              <Text style={styles.quickActionText}>Add Charge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recurring Job Section */}
        {editingJob && (editingJob as any).frequency && (
          <View style={styles.recurringSection}>
            <View style={styles.recurringSectionHeader}>
              <Ionicons
                name="repeat-outline"
                size={18}
                color={Theme.primary}
              />
              <Text style={styles.recurringSectionTitle}>Recurring Job</Text>
              <Text style={styles.recurringFrequency}>
                {(editingJob as any).frequency}
              </Text>
            </View>

            <View style={styles.recurringActions}>
              <TouchableOpacity
                style={styles.recurringBtn}
                onPress={() =>
                  handleRecurringAction("skip-next", "Skip Next", false)
                }
                disabled={recurringMutation.isPending}
              >
                <Ionicons
                  name="play-skip-forward-outline"
                  size={16}
                  color={Theme.foreground}
                />
                <Text style={styles.recurringBtnText}>Skip Next</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recurringBtn}
                onPress={() =>
                  handleRecurringAction("pause", "Pause", false)
                }
                disabled={recurringMutation.isPending}
              >
                <Ionicons name="pause-outline" size={16} color="#f59e0b" />
                <Text style={styles.recurringBtnText}>Pause</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recurringBtn}
                onPress={() =>
                  handleRecurringAction("resume", "Resume", false)
                }
                disabled={recurringMutation.isPending}
              >
                <Ionicons
                  name="play-outline"
                  size={16}
                  color={Theme.success}
                />
                <Text style={styles.recurringBtnText}>Resume</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recurringBtn, styles.recurringBtnDanger]}
                onPress={() =>
                  handleRecurringAction("cancel", "Cancel Series", true)
                }
                disabled={recurringMutation.isPending}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color="#ef4444"
                />
                <Text
                  style={[
                    styles.recurringBtnText,
                    styles.recurringBtnTextDanger,
                  ]}
                >
                  Cancel Series
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recurringBtn, styles.recurringBtnDanger]}
                onPress={() =>
                  handleRecurringAction("delete-future", "Delete Future", true)
                }
                disabled={recurringMutation.isPending}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text
                  style={[
                    styles.recurringBtnText,
                    styles.recurringBtnTextDanger,
                  ]}
                >
                  Delete Future
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment Section */}
        {editingJob && (
          <View style={styles.paymentSection}>
            <View style={styles.paymentSectionHeader}>
              <Ionicons name="card-outline" size={18} color={Theme.primary} />
              <Text style={styles.paymentSectionTitle}>Payment</Text>
            </View>

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.paymentBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  paymentLinkMutation.mutate(editingJob.id);
                }}
                disabled={paymentLinkMutation.isPending}
              >
                <Ionicons
                  name="link-outline"
                  size={16}
                  color={Theme.primary}
                />
                <Text style={styles.paymentBtnText}>
                  {paymentLinkMutation.isPending
                    ? "Generating..."
                    : "Generate Deposit Link"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  invoiceMutation.mutate(editingJob.id);
                }}
                disabled={invoiceMutation.isPending}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={Theme.primary}
                />
                <Text style={styles.paymentBtnText}>
                  {invoiceMutation.isPending ? "Sending..." : "Send Invoice"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  // View mode tabs
  viewModeTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.border,
  },
  viewModeTabActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  viewModeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
  viewModeTabTextActive: {
    color: Theme.primary,
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
  // Job cards
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
  membershipTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  membershipTagText: {
    fontSize: 11,
    color: Theme.violet400,
    fontWeight: "500",
  },
  conflictCard: {
    borderColor: Theme.destructive,
    borderWidth: 1,
  },
  conflictBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  conflictText: {
    fontSize: 11,
    color: Theme.destructive,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  // Compact job card (week view)
  compactJobCard: {
    backgroundColor: Theme.glassListItem,
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: Theme.primary,
  },
  compactJobName: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.foreground,
  },
  compactJobTime: {
    fontSize: 10,
    color: Theme.mutedForeground,
    marginTop: 1,
  },
  compactJobPrice: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.success,
    marginTop: 1,
  },
  membershipBadge: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  conflictIndicator: {
    position: "absolute",
    top: 2,
    right: 14,
  },
  // Week view
  weekContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  weekGrid: {},
  weekHeaderRow: {
    flexDirection: "row",
  },
  weekDayHeader: {
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: Theme.border,
  },
  weekDayHeaderActive: {
    borderBottomColor: Theme.primary,
  },
  weekDayHeaderToday: {
    backgroundColor: Theme.primaryMuted,
    borderRadius: 6,
  },
  weekDayHeaderText: {
    fontSize: 11,
    color: Theme.mutedForeground,
    fontWeight: "500",
  },
  weekDayHeaderDate: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
    marginTop: 2,
  },
  weekDayHeaderDateActive: {
    color: Theme.primary,
  },
  weekColumnsRow: {
    flexDirection: "row",
  },
  weekColumn: {
    paddingHorizontal: 2,
    paddingTop: 8,
    minHeight: 100,
    borderRightWidth: 1,
    borderRightColor: Theme.border,
  },
  weekEmptyText: {
    fontSize: 11,
    color: Theme.zinc600,
    textAlign: "center",
    marginTop: 16,
  },
  weekLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  // Month view
  monthContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
  },
  monthWeekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  monthWeekdayLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  monthRow: {
    flexDirection: "row",
  },
  monthCell: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  monthCellSelected: {
    backgroundColor: Theme.primaryMuted,
  },
  monthCellToday: {
    borderWidth: 1,
    borderColor: Theme.primary,
  },
  monthCellDate: {
    fontSize: 14,
    color: Theme.foreground,
  },
  monthCellDateSelected: {
    color: Theme.primary,
    fontWeight: "700",
  },
  monthJobCount: {
    backgroundColor: Theme.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  monthJobCountText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
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
    shadowColor: Theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  // Pickers
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
  // Address suggestions
  suggestionsContainer: {
    backgroundColor: Theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    marginTop: -4,
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: Theme.foreground,
  },
  // Pricing section
  pricingSection: {
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  pricingSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.primary,
    marginBottom: 8,
  },
  pricingRow: {
    flexDirection: "row",
    gap: 8,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Theme.successBg,
    borderRadius: 6,
  },
  estimateText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.success,
  },
  estimateUseText: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginLeft: "auto",
  },
  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.primary + "33",
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.primary,
  },
  modalActions: {
    marginTop: 8,
    gap: 10,
  },
  // Recurring Job Section
  recurringSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  recurringSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  recurringSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
    flex: 1,
  },
  recurringFrequency: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.primary,
    backgroundColor: Theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: "capitalize",
    overflow: "hidden",
  },
  recurringActions: {
    gap: 8,
  },
  recurringBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  recurringBtnDanger: {
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.05)",
  },
  recurringBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
  },
  recurringBtnTextDanger: {
    color: "#ef4444",
  },
  // Payment Section
  paymentSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  paymentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  paymentSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  paymentActions: {
    gap: 8,
  },
  paymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.primary + "33",
  },
  paymentBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.primary,
  },
});
