import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchSettings, updateSettings, fetchTeams, manageTeam } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      <View className="mx-4 mt-2 mb-3 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 items-center rounded-md py-2.5 ${
              activeTab === tab.key ? "bg-white dark:bg-dark-700" : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key ? "text-primary-500" : "text-dark-500 dark:text-dark-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={settingsQuery.isRefetching} onRefresh={onRefresh} />}
      >
        {activeTab === "settings" && (
          <View className="px-4">
            <Card className="mb-4">
              {settingsFields.map((field) => (
                <View key={field.key} className="mb-3">
                  <Text className="mb-1 text-sm font-medium text-dark-500 dark:text-dark-400">
                    {field.label}
                  </Text>
                  <TextInput
                    defaultValue={(settings[field.key] ?? "").toString()}
                    onChangeText={(v) => updateField(field.key, v)}
                    className="rounded-lg border border-dark-300 bg-white px-3 py-2.5 text-dark-900 dark:border-dark-600 dark:bg-dark-800 dark:text-white"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ))}
              <Button
                title="Save Settings"
                onPress={handleSaveSettings}
                loading={settingsMutation.isPending}
              />
            </Card>
          </View>
        )}

        {activeTab === "cleaners" && (
          <View className="px-4">
            {cleaners.map((cleaner, i) => (
              <Card key={cleaner.id || i} className="mb-2">
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Text className="font-semibold text-purple-600">{cleaner.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-dark-900 dark:text-white">{cleaner.name}</Text>
                    <Text className="text-sm text-dark-500 dark:text-dark-400">{cleaner.phone || cleaner.email || ""}</Text>
                  </View>
                  <View className="items-end">
                    <Badge
                      label={cleaner.active ? "Active" : "Inactive"}
                      variant={cleaner.active ? "success" : "error"}
                    />
                    {cleaner.employee_type && (
                      <Text className="mt-1 text-xs text-dark-400">{cleaner.employee_type}</Text>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {activeTab === "tenant" && (
          <View className="px-4">
            <Card>
              <Text className="mb-3 text-lg font-semibold text-dark-900 dark:text-white">
                Tenant Information
              </Text>
              <InfoRow label="Name" value={tenant?.name} />
              <InfoRow label="Business" value={tenant?.business_name} />
              <InfoRow label="Slug" value={tenant?.slug} />
              <InfoRow label="Status" value={tenant?.active ? "Active" : "Inactive"} />
              {tenant?.workflow_config && (
                <>
                  <Text className="mt-3 mb-2 text-sm font-semibold text-dark-700 dark:text-dark-300">
                    Workflow Config
                  </Text>
                  <InfoRow label="Stripe" value={tenant.workflow_config.use_stripe ? "Enabled" : "Disabled"} />
                  <InfoRow label="Auto Assignment" value={tenant.workflow_config.cleaner_assignment_auto ? "On" : "Off"} />
                  <InfoRow label="Assignment Mode" value={tenant.workflow_config.assignment_mode || "N/A"} />
                  <InfoRow label="Deposit Required" value={tenant.workflow_config.require_deposit ? `${tenant.workflow_config.deposit_percentage}%` : "No"} />
                  <InfoRow label="Lead Followup" value={tenant.workflow_config.lead_followup_enabled ? `${tenant.workflow_config.lead_followup_stages} stages` : "Off"} />
                </>
              )}
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row justify-between border-b border-dark-100 py-2.5 dark:border-dark-700">
      <Text className="text-dark-500 dark:text-dark-400">{label}</Text>
      <Text className="font-medium text-dark-900 dark:text-white">{value || "—"}</Text>
    </View>
  );
}
