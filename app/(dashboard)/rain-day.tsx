import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchRainDay, executeRainDay, fetchJobs } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { Job } from "@/types";

const OUTDOOR_TYPES = ["window", "pressure", "gutter"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function RainDayScreen() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [affectedDate, setAffectedDate] = useState(today);
  const [targetDate, setTargetDate] = useState(getTomorrow());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessCard, setShowSuccessCard] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<
    "affected" | "target" | null
  >(null);

  // Date picker quick options
  const affectedDateOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      opts.push({
        label: i === 0 ? `Today (${formatDate(d)})` : formatDate(d),
        value: d,
      });
    }
    return opts;
  }, [today]);

  const targetDateOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = addDays(affectedDate, i);
      opts.push({ label: formatDate(d), value: d });
    }
    return opts;
  }, [affectedDate]);

  // Fetch jobs for affected date
  const {
    data: jobsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["jobs", affectedDate, "rain-day"],
    queryFn: () => fetchJobs({ date: affectedDate }),
  });

  // Fetch rain day preview
  const { data: rainData } = useQuery({
    queryKey: ["rain-day-preview", affectedDate, targetDate],
    queryFn: () =>
      fetchRainDay({
        affected_date: affectedDate,
        target_date: targetDate,
      }),
  });

  const allJobs: Job[] =
    (jobsData as any)?.data ?? (jobsData as any)?.jobs ?? [];

  // Filter to outdoor jobs
  const outdoorJobs = useMemo(() => {
    return allJobs.filter((j) => {
      const svc = (j.service_type || "").toLowerCase();
      return OUTDOOR_TYPES.some((t) => svc.includes(t));
    });
  }, [allJobs]);

  const previewJobs: any[] =
    (rainData as any)?.affected_jobs ?? outdoorJobs;

  // Revenue impact
  const totalRevenue = useMemo(() => {
    return previewJobs.reduce((sum, j) => {
      return sum + Number(j.price || j.estimated_value || j.actual_value || 0);
    }, 0);
  }, [previewJobs]);

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      executeRainDay({
        affected_date: affectedDate,
        target_date: targetDate,
        job_ids: previewJobs.map((j: any) => j.id).filter(Boolean),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["rain-day-preview"] });
      setShowConfirmModal(false);
      setShowSuccessCard(true);
    },
    onError: (err: Error) => {
      setShowConfirmModal(false);
      Alert.alert("Error", err.message);
    },
  });

  const handleExecute = () => {
    if (previewJobs.length === 0) {
      Alert.alert("No Jobs", "No outdoor jobs found to reschedule.");
      return;
    }
    setShowConfirmModal(true);
  };

  if (isLoading) return <LoadingScreen message="Loading..." />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={Theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name="rainy" size={28} color={Theme.cyan400} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Rain Day Tool</Text>
          <Text style={styles.headerSub}>
            Reschedule outdoor jobs affected by weather
          </Text>
        </View>
      </View>

      {/* Date pickers */}
      <GlassCard>
        <Text style={styles.sectionTitle}>Select Dates</Text>

        {/* Affected date */}
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker("affected")}
          activeOpacity={0.7}
        >
          <View style={styles.dateSelectorLeft}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={Theme.destructive}
            />
            <View>
              <Text style={styles.dateSelectorLabel}>Affected Date</Text>
              <Text style={styles.dateSelectorValue}>
                {formatDate(affectedDate)}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Theme.zinc500}
          />
        </TouchableOpacity>

        {/* Target date */}
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker("target")}
          activeOpacity={0.7}
        >
          <View style={styles.dateSelectorLeft}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={Theme.success}
            />
            <View>
              <Text style={styles.dateSelectorLabel}>
                Reschedule To
              </Text>
              <Text style={styles.dateSelectorValue}>
                {formatDate(targetDate)}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Theme.zinc500}
          />
        </TouchableOpacity>
      </GlassCard>

      {/* Revenue impact */}
      <View style={styles.metricsRow}>
        <MetricCard
          title="Affected Jobs"
          value={previewJobs.length}
          icon="briefcase-outline"
          iconColor={Theme.warning}
          compact
        />
        <MetricCard
          title="Revenue Impact"
          value={`$${totalRevenue.toLocaleString()}`}
          icon="cash-outline"
          iconColor={Theme.destructive}
          compact
        />
      </View>

      {/* Success card */}
      {showSuccessCard && (
        <GlassCard style={styles.successCard}>
          <View style={styles.successRow}>
            <View style={styles.successIcon}>
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={Theme.success}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>
                Reschedule Complete
              </Text>
              <Text style={styles.successDesc}>
                {previewJobs.length} jobs moved to{" "}
                {formatDate(targetDate)}. SMS notifications sent.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSuccessCard(false)}
            >
              <Ionicons
                name="close"
                size={20}
                color={Theme.zinc500}
              />
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}

      {/* Job preview list */}
      <View style={styles.jobSection}>
        <Text style={styles.sectionTitle}>Affected Outdoor Jobs</Text>
        {previewJobs.length === 0 ? (
          <EmptyState
            icon="sunny-outline"
            title="No outdoor jobs"
            description="No outdoor jobs found for the selected date"
          />
        ) : (
          previewJobs.map((job: any, i: number) => (
            <GlassCard key={job.id || i} style={styles.jobCard}>
              <View style={styles.jobRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobName}>
                    {job.customer_name ||
                      job.phone_number ||
                      "Customer"}
                  </Text>
                  <View style={styles.jobMeta}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={Theme.zinc400}
                    />
                    <Text style={styles.jobMetaText}>
                      {job.scheduled_time || job.scheduled_at || "TBD"}
                    </Text>
                  </View>
                  {(job.address || job.customer_address) && (
                    <View style={styles.jobMeta}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={Theme.zinc400}
                      />
                      <Text
                        style={styles.jobMetaText}
                        numberOfLines={1}
                      >
                        {job.address || job.customer_address}
                      </Text>
                    </View>
                  )}
                  {(job.team_id || job.cleaner_name) && (
                    <View style={styles.jobMeta}>
                      <Ionicons
                        name="people-outline"
                        size={12}
                        color={Theme.zinc400}
                      />
                      <Text style={styles.jobMetaText}>
                        {job.cleaner_name || `Team ${job.team_id}`}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.jobRight}>
                  <Badge
                    label={job.service_type || "outdoor"}
                    variant="info"
                  />
                  <Text style={styles.jobRevenue}>
                    $
                    {Number(
                      job.price ||
                        job.estimated_value ||
                        job.actual_value ||
                        0
                    ).toFixed(0)}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </View>

      {/* Execute button */}
      {previewJobs.length > 0 && !showSuccessCard && (
        <View style={styles.executeSection}>
          <ActionButton
            title={`Reschedule ${previewJobs.length} Jobs to ${formatDate(targetDate)}`}
            onPress={handleExecute}
            variant="primary"
            loading={executeMutation.isPending}
          />
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Reschedule"
      >
        <View style={styles.confirmContent}>
          <View style={styles.confirmIcon}>
            <Ionicons name="rainy" size={36} color={Theme.cyan400} />
          </View>

          <Text style={styles.confirmTitle}>
            Reschedule {previewJobs.length} outdoor jobs?
          </Text>
          <Text style={styles.confirmSub}>
            From {formatDate(affectedDate)} to {formatDate(targetDate)}
          </Text>

          <GlassCard style={styles.confirmActions}>
            <Text style={styles.confirmActionsTitle}>
              This will:
            </Text>
            <View style={styles.confirmActionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Theme.success}
              />
              <Text style={styles.confirmActionText}>
                Update HCP job dates
              </Text>
            </View>
            <View style={styles.confirmActionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Theme.success}
              />
              <Text style={styles.confirmActionText}>
                Send SMS notifications to customers
              </Text>
            </View>
            <View style={styles.confirmActionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Theme.success}
              />
              <Text style={styles.confirmActionText}>
                Re-run team assignment for target date
              </Text>
            </View>
          </GlassCard>

          <View style={styles.confirmImpact}>
            <Text style={styles.confirmImpactLabel}>
              Revenue Impact
            </Text>
            <Text style={styles.confirmImpactValue}>
              ${totalRevenue.toLocaleString()}
            </Text>
          </View>

          <View style={styles.confirmBtns}>
            <ActionButton
              title="Cancel"
              onPress={() => setShowConfirmModal(false)}
              variant="outline"
            />
            <ActionButton
              title="Execute Reschedule"
              onPress={() => executeMutation.mutate()}
              variant="primary"
              loading={executeMutation.isPending}
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker !== null}
        onClose={() => setShowDatePicker(null)}
        title={
          showDatePicker === "affected"
            ? "Select Affected Date"
            : "Select Target Date"
        }
      >
        {(showDatePicker === "affected"
          ? affectedDateOptions
          : targetDateOptions
        ).map((opt) => {
          const isSelected =
            showDatePicker === "affected"
              ? affectedDate === opt.value
              : targetDate === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.dateOption,
                isSelected && styles.dateOptionActive,
              ]}
              onPress={() => {
                if (showDatePicker === "affected") {
                  setAffectedDate(opt.value);
                  // Adjust target if it is on or before affected
                  if (targetDate <= opt.value) {
                    setTargetDate(addDays(opt.value, 1));
                  }
                } else {
                  setTargetDate(opt.value);
                }
                setShowDatePicker(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  isSelected
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={
                  isSelected ? Theme.primary : Theme.zinc500
                }
              />
              <Text
                style={[
                  styles.dateOptionText,
                  isSelected && styles.dateOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Modal>
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
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.foreground,
  },
  headerSub: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.glassListItem,
    borderRadius: 8,
    padding: 12,
  },
  dateSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateSelectorLabel: {
    fontSize: 12,
    color: Theme.mutedForeground,
  },
  dateSelectorValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  successCard: {
    borderColor: "rgba(69,186,80,0.3)",
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Theme.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.success,
  },
  successDesc: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  jobSection: {
    gap: 8,
  },
  jobCard: {
    padding: 12,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  jobName: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
    marginBottom: 4,
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  jobMetaText: {
    fontSize: 12,
    color: Theme.zinc400,
  },
  jobRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  jobRevenue: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.success,
  },
  executeSection: {
    marginTop: 4,
  },
  // Confirm modal
  confirmContent: {
    gap: 12,
    alignItems: "center",
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "center",
  },
  confirmSub: {
    fontSize: 14,
    color: Theme.mutedForeground,
    textAlign: "center",
  },
  confirmActions: {
    width: "100%",
    gap: 8,
  },
  confirmActionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
  },
  confirmActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmActionText: {
    fontSize: 13,
    color: Theme.foreground,
  },
  confirmImpact: {
    alignItems: "center",
    gap: 2,
  },
  confirmImpactLabel: {
    fontSize: 12,
    color: Theme.mutedForeground,
  },
  confirmImpactValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Theme.warning,
  },
  confirmBtns: {
    width: "100%",
    gap: 8,
  },
  // Date picker
  dateOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.glassListItem,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dateOptionActive: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  dateOptionText: {
    fontSize: 14,
    color: Theme.foreground,
  },
  dateOptionTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
});
