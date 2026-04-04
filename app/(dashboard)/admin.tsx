import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchSettings, updateSettings, fetchTeams, manageTeam } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { Cleaner, TenantSettings } from "@/types";

type Tab = "settings" | "cleaners" | "tenant";

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const { tenant } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    enabled: activeTab === "cleaners",
  });

  const settings: TenantSettings = (settingsQuery.data as any)?.settings ?? {};
  const cleaners: Cleaner[] = (teamsQuery.data as any)?.cleaners ?? (teamsQuery.data as any)?.data ?? [];

  const settingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      Alert.alert("Success", "Settings updated");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const [editSettings, setEditSettings] = useState<Record<string, string>>({});

  const handleSaveSettings = () => {
    if (Object.keys(editSettings).length === 0) return;
    settingsMutation.mutate(editSettings);
    setEditSettings({});
  };

  const updateField = (key: string, value: string) => {
    setEditSettings((prev) => ({ ...prev, [key]: value }));
  };

  const onRefresh = async () => {
    await Promise.all([settingsQuery.refetch(), teamsQuery.refetch()]);
  };

  if (settingsQuery.isLoading) return <LoadingScreen message="Loading admin..." />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: "Settings" },
    { key: "cleaners", label: "Cleaners" },
    { key: "tenant", label: "Tenant" },
  ];

  const settingsFields = [
    { key: "business_name", label: "Business Name" },
    { key: "business_phone", label: "Business Phone" },
    { key: "business_email", label: "Business Email" },
    { key: "business_address", label: "Business Address" },
    { key: "business_hours_start", label: "Hours Start" },
    { key: "business_hours_end", label: "Hours End" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={settingsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />}
      >
        {activeTab === "settings" && (
          <View style={styles.listPadding}>
            <GlassCard style={styles.formCard}>
              {settingsFields.map((field) => (
                <View key={field.key} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    defaultValue={(settings[field.key] ?? "").toString()}
                    onChangeText={(v) => updateField(field.key, v)}
                    style={styles.input}
                    placeholderTextColor={Theme.mutedForeground}
                  />
                </View>
              ))}
              <Button
                title="Save Settings"
                onPress={handleSaveSettings}
                loading={settingsMutation.isPending}
              />
            </GlassCard>
          </View>
        )}

        {activeTab === "cleaners" && (
          <View style={styles.listPadding}>
            {cleaners.map((cleaner, i) => (
              <GlassCard key={cleaner.id || i} style={styles.cardSpacing}>
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{cleaner.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.nameText}>{cleaner.name}</Text>
                    <Text style={styles.subText}>{cleaner.phone || cleaner.email || ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Badge
                      label={cleaner.active ? "Active" : "Inactive"}
                      variant={cleaner.active ? "success" : "error"}
                    />
                    {cleaner.employee_type && (
                      <Text style={styles.employeeType}>{cleaner.employee_type}</Text>
                    )}
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {activeTab === "tenant" && (
          <View style={styles.listPadding}>
            <GlassCard>
              <Text style={styles.sectionTitle}>Tenant Information</Text>
              <InfoRow label="Name" value={tenant?.name} />
              <InfoRow label="Business" value={tenant?.business_name} />
              <InfoRow label="Slug" value={tenant?.slug} />
              <InfoRow label="Status" value={tenant?.active ? "Active" : "Inactive"} />
              {tenant?.workflow_config && (
                <>
                  <Text style={styles.subsectionTitle}>Workflow Config</Text>
                  <InfoRow label="Stripe" value={tenant.workflow_config.use_stripe ? "Enabled" : "Disabled"} />
                  <InfoRow label="Auto Assignment" value={tenant.workflow_config.cleaner_assignment_auto ? "On" : "Off"} />
                  <InfoRow label="Assignment Mode" value={tenant.workflow_config.assignment_mode || "N/A"} />
                  <InfoRow label="Deposit Required" value={tenant.workflow_config.require_deposit ? `${tenant.workflow_config.deposit_percentage}%` : "No"} />
                  <InfoRow label="Lead Followup" value={tenant.workflow_config.lead_followup_enabled ? `${tenant.workflow_config.lead_followup_stages} stages` : "Off"} />
                </>
              )}
            </GlassCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value || "\u2014"}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    paddingVertical: 10,
  },
  label: {
    color: Theme.mutedForeground,
  },
  value: {
    fontWeight: "500",
    color: Theme.foreground,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 10,
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
  listPadding: {
    paddingHorizontal: 16,
  },
  formCard: {
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.foreground,
    fontSize: 15,
  },
  cardSpacing: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "600",
    color: Theme.primaryLight,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  employeeType: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 12,
  },
  subsectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
  },
});
