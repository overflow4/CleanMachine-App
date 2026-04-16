import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Alert, TextInput, StyleSheet, Switch, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  fetchSettings, updateSettings, fetchTeams, fetchAdminUsers,
  fetchSystemEvents, adminTestConnection, adminRegisterWebhook,
  adminResetCustomer, seedDemoData, sendEmployeeCredentials,
  apiFetch,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { Cleaner, TenantSettings } from "@/types";

/* ── Constants ── */

const TEST_PERSONS = [
  { name: "Dominic", phone: "4242755847" },
  { name: "Daniel", phone: "4243270461" },
  { name: "Jack", phone: "4157204580", email: "JasperGrenager@gmail.com" },
];

type Tab = "controls" | "settings" | "credentials" | "cleaners" | "events" | "demo";

const INTEGRATIONS = [
  { key: "openphone", label: "OpenPhone", icon: "call-outline" as const },
  { key: "stripe", label: "Stripe", icon: "card-outline" as const },
  { key: "vapi", label: "VAPI", icon: "mic-outline" as const },
  { key: "hcp", label: "HCP", icon: "home-outline" as const },
  { key: "ghl", label: "GHL", icon: "megaphone-outline" as const },
  { key: "wave", label: "Wave", icon: "analytics-outline" as const },
];

const CREDENTIAL_SECTIONS = [
  {
    provider: "OpenPhone",
    fields: [
      { key: "openphone_api_key", label: "API Key" },
      { key: "openphone_phone_number_id", label: "Phone Number ID" },
    ],
  },
  {
    provider: "VAPI",
    fields: [
      { key: "vapi_api_key", label: "API Key" },
      { key: "vapi_inbound_assistant_id", label: "Inbound Assistant ID" },
      { key: "vapi_outbound_assistant_id", label: "Outbound Assistant ID" },
    ],
  },
  {
    provider: "Stripe",
    fields: [
      { key: "stripe_secret_key", label: "Secret Key" },
      { key: "stripe_publishable_key", label: "Publishable Key" },
      { key: "stripe_webhook_secret", label: "Webhook Secret" },
    ],
  },
  {
    provider: "HCP",
    fields: [
      { key: "hcp_api_key", label: "API Key" },
    ],
  },
  {
    provider: "GHL",
    fields: [
      { key: "ghl_api_key", label: "API Key" },
      { key: "ghl_location_id", label: "Location ID" },
    ],
  },
];

const FLOW_TYPES: { value: string; label: string; description: string }[] = [
  { value: "winbros", label: "WinBros", description: "Window cleaning focused flow" },
  { value: "spotless", label: "Spotless", description: "House cleaning focused flow" },
  { value: "cedar", label: "Cedar", description: "Multi-service cedar flow" },
];

const WORKFLOW_TOGGLES: { key: string; label: string; description: string }[] = [
  { key: "sms_auto_response_enabled", label: "SMS Auto-Response", description: "AI responds to incoming messages automatically" },
  { key: "use_housecall_pro", label: "HCP Sync", description: "Sync jobs and customers with HousecallPro" },
  { key: "use_stripe", label: "Payment Collection", description: "Collect payments via Stripe" },
  { key: "use_vapi_inbound", label: "VAPI Inbound", description: "Handle inbound calls with VAPI AI" },
  { key: "cleaner_assignment_auto", label: "Auto Assignment", description: "Automatically assign cleaners to new jobs" },
  { key: "lead_followup_enabled", label: "Lead Follow-up", description: "Automated lead follow-up sequences" },
  { key: "require_deposit", label: "Require Deposit", description: "Require deposit before job confirmation" },
  { key: "use_route_optimization", label: "Route Optimization", description: "Optimize daily routes for crews" },
  { key: "use_card_on_file", label: "Card on File", description: "Require card on file for booking" },
  { key: "team_routing_enabled", label: "Team Routing", description: "Route jobs to specific teams by area" },
  { key: "review_request_enabled", label: "Review Requests", description: "Send review requests after job completion" },
  { key: "retargeting_enabled", label: "Retargeting", description: "Re-engage inactive customers automatically" },
  { key: "rainy_day_reschedule", label: "Rainy Day Reschedule", description: "Auto-reschedule jobs on rainy days" },
];

const DEMO_ACTIONS: { action: string; label: string; icon: string }[] = [
  { action: "seed_all", label: "Seed All Data", icon: "layers-outline" },
  { action: "add_team", label: "Add Team", icon: "people-outline" },
  { action: "add_cleaner", label: "Add Cleaner", icon: "person-add-outline" },
  { action: "add_job", label: "Add Job", icon: "briefcase-outline" },
  { action: "add_lead", label: "Add Lead", icon: "flash-outline" },
  { action: "add_call", label: "Add Call", icon: "call-outline" },
  { action: "add_tip", label: "Add Tip", icon: "cash-outline" },
  { action: "add_upsell", label: "Add Upsell", icon: "trending-up-outline" },
  { action: "add_message", label: "Add Message", icon: "chatbubble-outline" },
];

const EVENT_SOURCES = ["all", "system", "webhook", "cron", "api", "user"];

/* ── Main Component ── */

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("controls");
  const { tenant, refresh } = useAuth();
  const queryClient = useQueryClient();

  /* top-level state */
  const [systemActive, setSystemActive] = useState(tenant?.active ?? true);

  /* controls tab */
  const [flowType, setFlowType] = useState(
    (tenant?.workflow_config as any)?.flow_type ?? "spotless"
  );
  const [followupStages, setFollowupStages] = useState(
    String(tenant?.workflow_config?.lead_followup_stages ?? 3)
  );
  const [followupDelay, setFollowupDelay] = useState("24");
  const [skipCallsForSms, setSkipCallsForSms] = useState(false);

  /* settings tab */
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});

  /* credentials tab */
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [credSaving, setCredSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [providerTesting, setProviderTesting] = useState<string | null>(null);
  const [webhookRegistering, setWebhookRegistering] = useState<string | null>(null);

  /* events tab */
  const [eventSource, setEventSource] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  /* demo tab */
  const [seedingAction, setSeedingAction] = useState<string | null>(null);
  const [resettingPerson, setResettingPerson] = useState<string | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState(false);

  /* seasonal campaigns */
  const [campaigns, setCampaigns] = useState<any[]>([]);

  /* queries */
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: activeTab === "cleaners" || activeTab === "controls" });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers, enabled: activeTab === "controls" });
  const eventsQuery = useQuery({
    queryKey: ["system-events", eventSource],
    queryFn: () => fetchSystemEvents(eventSource !== "all" ? { source: eventSource } : undefined),
    enabled: activeTab === "events",
  });

  const settings: TenantSettings = (settingsQuery.data as any)?.settings ?? (settingsQuery.data as any)?.data?.settings ?? {};
  const cleaners: Cleaner[] = (teamsQuery.data as any)?.data?.cleaners ?? (teamsQuery.data as any)?.cleaners ?? (teamsQuery.data as any)?.data ?? [];
  const users: any[] = (usersQuery.data as any)?.data?.users ?? (usersQuery.data as any)?.users ?? (usersQuery.data as any)?.data ?? [];
  const events: any[] = (eventsQuery.data as any)?.data?.events ?? (eventsQuery.data as any)?.events ?? (eventsQuery.data as any)?.data ?? [];

  const settingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  /* ── Setup progress ── */
  const setupChecklist = [
    { label: "OpenPhone credentials", done: !!(tenant as any)?.openphone_api_key || !!credentials.openphone_api_key },
    { label: "Stripe credentials", done: !!tenant?.stripe_secret_key || !!credentials.stripe_secret_key },
    { label: "VAPI credentials", done: !!(tenant as any)?.vapi_api_key || !!credentials.vapi_api_key },
    { label: "Webhook registered", done: !!(tenant as any)?.webhook_registered },
    { label: "Business name set", done: !!settings.business_name || !!tenant?.business_name },
    { label: "At least 1 cleaner", done: cleaners.length > 0 },
  ];
  const setupDone = setupChecklist.filter((c) => c.done).length;
  const setupTotal = setupChecklist.length;
  const setupPct = Math.round((setupDone / setupTotal) * 100);

  /* ── Integration statuses ── */
  const getIntegrationStatus = (key: string): "connected" | "untested" | "not_configured" => {
    if (testResults[key]?.ok) return "connected";
    const hasCredential = CREDENTIAL_SECTIONS.some(
      (s) => s.provider.toLowerCase() === key && s.fields.some((f) => credentials[f.key] || (tenant as any)?.[f.key])
    );
    if (hasCredential) return "untested";
    return "not_configured";
  };

  const statusColor = (status: "connected" | "untested" | "not_configured") => {
    if (status === "connected") return Theme.success;
    if (status === "untested") return Theme.warning;
    return Theme.mutedForeground;
  };

  const statusLabel = (status: "connected" | "untested" | "not_configured") => {
    if (status === "connected") return "Connected";
    if (status === "untested") return "Untested";
    return "Not configured";
  };

  /* ── Helpers ── */
  const toggleTenantField = async (field: string, value: boolean) => {
    try {
      await apiFetch("/api/admin/tenants", {
        method: "PATCH",
        body: JSON.stringify({ tenantId: tenant?.id, [field]: value }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      refresh().catch(() => {});
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const toggleSystem = async (v: boolean) => {
    setSystemActive(v);
    await toggleTenantField("active", v);
  };

  const testConnection = async (service: string) => {
    setProviderTesting(service);
    try {
      const res: any = await adminTestConnection({ service });
      const ok = res?.data?.ok ?? res?.ok ?? res?.success ?? false;
      const message = res?.data?.message ?? res?.message ?? (ok ? "Connected" : "Failed");
      setTestResults((prev) => ({ ...prev, [service]: { ok, message } }));
      Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [service]: { ok: false, message: err.message } }));
    } finally {
      setProviderTesting(null);
    }
  };

  const registerWebhook = async (service: string) => {
    setWebhookRegistering(service);
    try {
      await adminRegisterWebhook({ service });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Webhook registered for ${service}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setWebhookRegistering(null);
    }
  };

  const maskValue = (val: string | undefined) => {
    if (!val) return "";
    if (val.length <= 4) return val;
    return "\u2022".repeat(val.length - 4) + val.slice(-4);
  };

  const copyToClipboard = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  const saveCredentials = async () => {
    setCredSaving(true);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "PATCH",
        body: JSON.stringify({ tenantId: tenant?.id, credentials }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Credentials saved successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCredSaving(false);
    }
  };

  const runSeedAction = async (action: string) => {
    setSeedingAction(action);
    try {
      await seedDemoData(action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Demo action "${action}" completed`);
      queryClient.invalidateQueries();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSeedingAction(null);
    }
  };

  const resetPerson = async (person: typeof TEST_PERSONS[0]) => {
    setResettingPerson(person.name);
    try {
      await adminResetCustomer({
        phoneNumber: person.phone,
        email: (person as any).email,
        crossTenant: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `${person.name} reset successfully`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setResettingPerson(null);
    }
  };

  const deleteBusiness = () => {
    Alert.alert(
      "Delete Business",
      "This will permanently delete this business and ALL its data. This cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setDeletingBusiness(true);
            try {
              await apiFetch("/api/admin/tenants", {
                method: "DELETE",
                body: JSON.stringify({ tenantId: tenant?.id }),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Deleted", "Business has been deleted");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setDeletingBusiness(false);
            }
          },
        },
      ]
    );
  };

  const updateFlowType = async (value: string) => {
    setFlowType(value);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "PATCH",
        body: JSON.stringify({ tenantId: tenant?.id, flow_type: value }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const updateFollowupConfig = async () => {
    try {
      await apiFetch("/api/admin/tenants", {
        method: "PATCH",
        body: JSON.stringify({
          tenantId: tenant?.id,
          lead_followup_stages: parseInt(followupStages, 10),
          lead_followup_delay_hours: parseInt(followupDelay, 10),
          skip_calls_for_sms_leads: skipCallsForSms,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const onRefresh = async () => {
    await Promise.all([
      settingsQuery.refetch(),
      teamsQuery.refetch(),
      activeTab === "events" ? eventsQuery.refetch() : Promise.resolve(),
      activeTab === "controls" ? usersQuery.refetch() : Promise.resolve(),
    ]);
  };

  if (settingsQuery.isLoading) return <LoadingScreen message="Loading admin..." />;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "controls", label: "Controls", icon: "settings-outline" },
    { key: "settings", label: "Settings", icon: "business-outline" },
    { key: "credentials", label: "Creds", icon: "key-outline" },
    { key: "cleaners", label: "Cleaners", icon: "people-outline" },
    { key: "events", label: "Events", icon: "list-outline" },
    { key: "demo", label: "Demo", icon: "flask-outline" },
  ];

  return (
    <View style={s.container}>
      {/* System toggle header */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={[s.statusDot, { backgroundColor: systemActive ? Theme.success : Theme.destructive }]} />
          <Text style={s.headerTitle}>System {systemActive ? "Active" : "Paused"}</Text>
        </View>
        <Switch
          value={systemActive}
          onValueChange={toggleSystem}
          trackColor={{ false: "rgba(212,9,36,0.3)", true: "rgba(69,186,80,0.3)" }}
          thumbColor={systemActive ? Theme.success : Theme.destructive}
        />
      </View>

      {/* Setup Progress */}
      <View style={s.progressContainer}>
        <View style={s.progressHeader}>
          <Text style={s.progressLabel}>Setup Progress</Text>
          <Text style={s.progressPct}>{setupPct}%</Text>
        </View>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${setupPct}%` as any }]} />
        </View>
        <View style={s.checklistRow}>
          {setupChecklist.map((item) => (
            <View key={item.label} style={s.checklistItem}>
              <Ionicons
                name={item.done ? "checkmark-circle" : "ellipse-outline"}
                size={14}
                color={item.done ? Theme.success : Theme.mutedForeground}
              />
              <Text style={[s.checklistText, item.done && { color: Theme.success }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBarContent}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tab, activeTab === tab.key && s.tabActive]}>
            <Ionicons name={tab.icon as any} size={15} color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={settingsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />}
      >
        {/* ── Controls Tab ── */}
        {activeTab === "controls" && (
          <View style={s.section}>
            {/* Integration Status */}
            <GlassCard>
              <Text style={s.sectionTitle}>Integration Status</Text>
              {INTEGRATIONS.map((integ) => {
                const status = getIntegrationStatus(integ.key);
                return (
                  <View key={integ.key} style={s.integrationRow}>
                    <View style={s.integrationLeft}>
                      <Ionicons name={integ.icon} size={20} color={Theme.foreground} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={s.integrationName}>{integ.label}</Text>
                        <Text style={[s.integrationStatus, { color: statusColor(status) }]}>
                          {statusLabel(status)}
                        </Text>
                      </View>
                    </View>
                    <View style={s.integrationActions}>
                      <TouchableOpacity
                        onPress={() => testConnection(integ.key)}
                        disabled={providerTesting !== null}
                        style={s.miniBtn}
                      >
                        {providerTesting === integ.key ? (
                          <ActivityIndicator size="small" color={Theme.primary} />
                        ) : (
                          <Text style={s.miniBtnText}>Test</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => registerWebhook(integ.key)}
                        disabled={webhookRegistering !== null}
                        style={[s.miniBtn, { borderColor: Theme.warning }]}
                      >
                        {webhookRegistering === integ.key ? (
                          <ActivityIndicator size="small" color={Theme.warning} />
                        ) : (
                          <Ionicons name="link-outline" size={14} color={Theme.warning} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </GlassCard>

            {/* Workflow Config Toggles */}
            <GlassCard>
              <Text style={s.sectionTitle}>Workflow Configuration</Text>
              {WORKFLOW_TOGGLES.map((toggle) => (
                <ToggleRow
                  key={toggle.key}
                  label={toggle.label}
                  description={toggle.description}
                  value={(tenant?.workflow_config as any)?.[toggle.key] ?? false}
                  onToggle={(v) => toggleTenantField(toggle.key, v)}
                />
              ))}
            </GlassCard>

            {/* Business Flow Type */}
            <GlassCard>
              <Text style={s.sectionTitle}>Business Flow Type</Text>
              {FLOW_TYPES.map((ft) => (
                <TouchableOpacity
                  key={ft.value}
                  onPress={() => updateFlowType(ft.value)}
                  style={[s.flowTypeCard, flowType === ft.value && s.flowTypeCardActive]}
                >
                  <View style={s.flowTypeHeader}>
                    <Ionicons
                      name={flowType === ft.value ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={flowType === ft.value ? Theme.primary : Theme.mutedForeground}
                    />
                    <Text style={[s.flowTypeLabel, flowType === ft.value && { color: Theme.primary }]}>
                      {ft.label}
                    </Text>
                  </View>
                  <Text style={s.flowTypeDesc}>{ft.description}</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>

            {/* Lead Follow-up Config */}
            <GlassCard>
              <Text style={s.sectionTitle}>Lead Follow-up Configuration</Text>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Stages</Text>
                <TextInput
                  value={followupStages}
                  onChangeText={setFollowupStages}
                  style={s.input}
                  keyboardType="number-pad"
                  placeholderTextColor={Theme.mutedForeground}
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Delay between stages (hours)</Text>
                <TextInput
                  value={followupDelay}
                  onChangeText={setFollowupDelay}
                  style={s.input}
                  keyboardType="number-pad"
                  placeholderTextColor={Theme.mutedForeground}
                />
              </View>
              <ToggleRow
                label="Skip calls for SMS leads"
                description="Use SMS-only follow-up for leads that came in via text"
                value={skipCallsForSms}
                onToggle={setSkipCallsForSms}
              />
              <TouchableOpacity onPress={updateFollowupConfig} style={s.saveBtn}>
                <Text style={s.saveBtnText}>Save Follow-up Config</Text>
              </TouchableOpacity>
            </GlassCard>

            {/* User Management */}
            <GlassCard>
              <Text style={s.sectionTitle}>Users</Text>
              {usersQuery.isLoading ? (
                <ActivityIndicator color={Theme.primary} />
              ) : users.length === 0 ? (
                <Text style={s.emptyText}>No users found</Text>
              ) : (
                users.map((user: any, i: number) => (
                  <View key={user.id ?? i} style={s.userRow}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{(user.display_name || user.username || "?")[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.nameText}>{user.display_name || user.username}</Text>
                      <Text style={s.subText}>{user.email || user.username}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: user.is_active ? Theme.successBg : Theme.destructiveBg }]}>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: user.is_active ? Theme.success : Theme.destructive }}>
                        {user.role || "user"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </GlassCard>
          </View>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <View style={s.section}>
            <GlassCard>
              <Text style={s.sectionTitle}>Business Information</Text>
              {[
                { key: "business_name", label: "Business Name" },
                { key: "business_phone", label: "Business Phone" },
                { key: "business_email", label: "Business Email" },
                { key: "business_address", label: "Business Address" },
                { key: "business_hours_start", label: "Hours Start" },
                { key: "business_hours_end", label: "Hours End" },
              ].map((field) => (
                <View key={field.key} style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>{field.label}</Text>
                  <TextInput
                    defaultValue={(settings[field.key] ?? "").toString()}
                    onChangeText={(v) => setEditSettings((p) => ({ ...p, [field.key]: v }))}
                    style={s.input}
                    placeholderTextColor={Theme.mutedForeground}
                  />
                </View>
              ))}
              {Object.keys(editSettings).length > 0 && (
                <TouchableOpacity
                  onPress={() => { settingsMutation.mutate(editSettings); setEditSettings({}); }}
                  style={s.saveBtn}
                >
                  <Text style={s.saveBtnText}>
                    {settingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Text>
                </TouchableOpacity>
              )}
            </GlassCard>

            {/* Tenant Info */}
            <GlassCard>
              <Text style={s.sectionTitle}>Tenant Information</Text>
              <InfoRow label="Name" value={tenant?.name} />
              <InfoRow label="Business" value={tenant?.business_name} />
              <InfoRow label="Slug" value={tenant?.slug} />
              <InfoRow label="Status" value={tenant?.active ? "Active" : "Inactive"} />
              <InfoRow label="Stripe" value={tenant?.workflow_config?.use_stripe ? "Enabled" : "Disabled"} />
              <InfoRow label="Assignment Mode" value={tenant?.workflow_config?.assignment_mode || "N/A"} />
            </GlassCard>

            {/* Seasonal Campaigns */}
            <GlassCard>
              <Text style={s.sectionTitle}>Seasonal Campaigns</Text>
              {campaigns.length === 0 ? (
                <Text style={s.emptyText}>No seasonal campaigns configured</Text>
              ) : (
                campaigns.map((campaign: any, i: number) => (
                  <View key={campaign.id ?? i} style={s.campaignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.nameText}>{campaign.name}</Text>
                      <Text style={s.subText}>{campaign.description || "No description"}</Text>
                    </View>
                    <Switch
                      value={campaign.enabled ?? false}
                      onValueChange={(v) => {
                        setCampaigns((prev) =>
                          prev.map((c, idx) => (idx === i ? { ...c, enabled: v } : c))
                        );
                      }}
                      trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
                      thumbColor={campaign.enabled ? Theme.primary : Theme.mutedForeground}
                    />
                  </View>
                ))
              )}
              <TouchableOpacity
                onPress={() => {
                  setCampaigns((prev) => [
                    ...prev,
                    { id: Date.now().toString(), name: "New Campaign", description: "", enabled: false },
                  ]);
                }}
                style={s.outlineBtn}
              >
                <Ionicons name="add" size={16} color={Theme.primary} />
                <Text style={s.outlineBtnText}>Add Campaign</Text>
              </TouchableOpacity>
            </GlassCard>

            {/* Danger Zone */}
            <GlassCard>
              <Text style={[s.sectionTitle, { color: Theme.destructive }]}>Danger Zone</Text>
              <TouchableOpacity
                onPress={deleteBusiness}
                disabled={deletingBusiness}
                style={s.dangerBtn}
              >
                {deletingBusiness ? (
                  <ActivityIndicator size="small" color={Theme.destructive} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={Theme.destructive} />
                )}
                <Text style={s.dangerBtnText}>Delete Business</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        )}

        {/* ── Credentials Tab ── */}
        {activeTab === "credentials" && (
          <View style={s.section}>
            {CREDENTIAL_SECTIONS.map((section) => {
              const providerKey = section.provider.toLowerCase();
              const result = testResults[providerKey];
              return (
                <GlassCard key={section.provider} style={{ marginBottom: 4 }}>
                  <View style={s.providerHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={s.sectionTitle}>{section.provider}</Text>
                      {result && (
                        <Ionicons
                          name={result.ok ? "checkmark-circle" : "close-circle"}
                          size={18}
                          color={result.ok ? Theme.success : Theme.destructive}
                        />
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => testConnection(providerKey)}
                        disabled={providerTesting !== null}
                        style={s.miniBtn}
                      >
                        {providerTesting === providerKey ? (
                          <ActivityIndicator size="small" color={Theme.primary} />
                        ) : (
                          <Text style={s.miniBtnText}>Test</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => registerWebhook(providerKey)}
                        disabled={webhookRegistering !== null}
                        style={[s.miniBtn, { borderColor: Theme.warning }]}
                      >
                        {webhookRegistering === providerKey ? (
                          <ActivityIndicator size="small" color={Theme.warning} />
                        ) : (
                          <Text style={[s.miniBtnText, { color: Theme.warning }]}>Hook</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  {result && (
                    <Text style={{ fontSize: 12, color: result.ok ? Theme.success : Theme.destructive, marginBottom: 4 }}>
                      {result.message}
                    </Text>
                  )}
                  {section.fields.map((field) => {
                    const revealed = revealedFields[field.key];
                    const currentVal = credentials[field.key] ?? "";
                    return (
                      <View key={field.key} style={s.fieldGroup}>
                        <Text style={s.fieldLabel}>{field.label}</Text>
                        <View style={s.credRow}>
                          <TextInput
                            value={revealed ? currentVal : maskValue(currentVal)}
                            onChangeText={(v) => setCredentials((p) => ({ ...p, [field.key]: v }))}
                            editable={revealed}
                            style={[s.input, { flex: 1 }]}
                            placeholderTextColor={Theme.mutedForeground}
                            placeholder={`Enter ${field.label}`}
                            secureTextEntry={!revealed}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            onPress={() => setRevealedFields((p) => ({ ...p, [field.key]: !p[field.key] }))}
                            style={s.credIconBtn}
                          >
                            <Ionicons name={revealed ? "eye-off-outline" : "create-outline"} size={18} color={Theme.primary} />
                          </TouchableOpacity>
                          {currentVal.length > 0 && (
                            <TouchableOpacity
                              onPress={() => copyToClipboard(currentVal, field.label)}
                              style={s.credIconBtn}
                            >
                              <Ionicons name="copy-outline" size={18} color={Theme.mutedForeground} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </GlassCard>
              );
            })}

            <TouchableOpacity onPress={saveCredentials} disabled={credSaving} style={s.saveBtn}>
              {credSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>Save All Credentials</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Cleaners Tab ── */}
        {activeTab === "cleaners" && (
          <View style={s.section}>
            {teamsQuery.isLoading ? (
              <ActivityIndicator color={Theme.primary} style={{ marginTop: 20 }} />
            ) : cleaners.length === 0 ? (
              <GlassCard>
                <Text style={s.emptyText}>No cleaners found</Text>
              </GlassCard>
            ) : (
              cleaners.map((cleaner, i) => (
                <GlassCard key={cleaner.id || i} style={{ marginBottom: 4 }}>
                  <View style={s.row}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{cleaner.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={s.nameText}>{cleaner.name}</Text>
                      <Text style={s.subText}>{cleaner.phone || cleaner.email || ""}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={[s.badge, { backgroundColor: cleaner.active ? Theme.successBg : Theme.destructiveBg }]}>
                        <Text style={{ fontSize: 11, fontWeight: "500", color: cleaner.active ? Theme.success : Theme.destructive }}>
                          {cleaner.active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert("Send Credentials", `Send login credentials to ${cleaner.name}?`, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Send",
                              onPress: async () => {
                                try {
                                  await sendEmployeeCredentials(typeof cleaner.id === "string" ? parseInt(cleaner.id, 10) : Number(cleaner.id ?? 0));
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  Alert.alert("Sent", "Credentials sent");
                                } catch (err: any) {
                                  Alert.alert("Error", err.message);
                                }
                              },
                            },
                          ]);
                        }}
                        style={s.miniBtn}
                      >
                        <Ionicons name="mail-outline" size={14} color={Theme.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        {/* ── Events Tab (Audit Log) ── */}
        {activeTab === "events" && (
          <View style={s.section}>
            {/* Source filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {EVENT_SOURCES.map((src) => (
                  <TouchableOpacity
                    key={src}
                    onPress={() => setEventSource(src)}
                    style={[s.filterChip, eventSource === src && s.filterChipActive]}
                  >
                    <Text style={[s.filterChipText, eventSource === src && s.filterChipTextActive]}>
                      {src.charAt(0).toUpperCase() + src.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {eventsQuery.isLoading ? (
              <ActivityIndicator color={Theme.primary} style={{ marginTop: 20 }} />
            ) : events.length === 0 ? (
              <GlassCard>
                <Text style={s.emptyText}>No system events found</Text>
              </GlassCard>
            ) : (
              events.map((event: any, i: number) => {
                const isExpanded = expandedEvent === (event.id ?? String(i));
                return (
                  <TouchableOpacity
                    key={event.id ?? i}
                    onPress={() => setExpandedEvent(isExpanded ? null : (event.id ?? String(i)))}
                    activeOpacity={0.7}
                  >
                    <GlassCard style={{ marginBottom: 4 }}>
                      <View style={s.eventHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.eventType}>{event.event_type || event.type || "event"}</Text>
                          <Text style={s.eventTime}>
                            {event.created_at ? new Date(event.created_at).toLocaleString() : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {event.source && (
                            <View style={s.sourceChip}>
                              <Text style={s.sourceChipText}>{event.source}</Text>
                            </View>
                          )}
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={Theme.mutedForeground}
                          />
                        </View>
                      </View>
                      {event.message && (
                        <Text style={s.eventMessage} numberOfLines={isExpanded ? undefined : 2}>
                          {event.message}
                        </Text>
                      )}
                      {isExpanded && event.metadata && (
                        <View style={s.metadataBox}>
                          <Text style={s.metadataText}>
                            {typeof event.metadata === "string"
                              ? event.metadata
                              : JSON.stringify(event.metadata, null, 2)}
                          </Text>
                        </View>
                      )}
                    </GlassCard>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── Demo Tab ── */}
        {activeTab === "demo" && (
          <View style={s.section}>
            {/* Demo Data Generator */}
            <GlassCard>
              <Text style={s.sectionTitle}>Demo Data Generator</Text>
              <View style={s.demoGrid}>
                {DEMO_ACTIONS.map((da) => (
                  <TouchableOpacity
                    key={da.action}
                    onPress={() => runSeedAction(da.action)}
                    disabled={seedingAction !== null}
                    style={[s.demoBtn, seedingAction !== null && { opacity: 0.5 }]}
                  >
                    {seedingAction === da.action ? (
                      <ActivityIndicator size="small" color={Theme.primary} />
                    ) : (
                      <Ionicons name={da.icon as any} size={20} color={Theme.primary} />
                    )}
                    <Text style={s.demoBtnText}>{da.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>

            {/* Test Person Reset */}
            <GlassCard>
              <Text style={s.sectionTitle}>Reset Test Persons</Text>
              <View style={s.resetGrid}>
                {TEST_PERSONS.map((person) => (
                  <TouchableOpacity
                    key={person.name}
                    onPress={() => resetPerson(person)}
                    disabled={resettingPerson !== null}
                    style={[s.resetBtn, resettingPerson !== null && { opacity: 0.5 }]}
                    activeOpacity={0.7}
                  >
                    {resettingPerson === person.name ? (
                      <ActivityIndicator size="small" color={Theme.red400} />
                    ) : (
                      <Ionicons name="refresh" size={16} color={Theme.red400} />
                    )}
                    <Text style={s.resetBtnText}>
                      {resettingPerson === person.name ? "Resetting..." : `Reset ${person.name}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>

            {/* Danger Zone */}
            <GlassCard>
              <Text style={[s.sectionTitle, { color: Theme.destructive }]}>Danger Zone</Text>
              <TouchableOpacity
                onPress={deleteBusiness}
                disabled={deletingBusiness}
                style={s.dangerBtn}
              >
                {deletingBusiness ? (
                  <ActivityIndicator size="small" color={Theme.destructive} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={Theme.destructive} />
                )}
                <Text style={s.dangerBtnText}>Delete Business</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ── */

function ToggleRow({ label, description, value, onToggle }: {
  label: string; description: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
        thumbColor={value ? Theme.primary : Theme.mutedForeground}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.infoRow}>
      <Text style={{ color: Theme.mutedForeground, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: Theme.foreground, fontWeight: "500", fontSize: 14 }}>{value || "\u2014"}</Text>
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },

  /* Header / system toggle */
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  /* Setup progress */
  progressContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  progressPct: { fontSize: 13, fontWeight: "600", color: Theme.primary },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: Theme.muted, overflow: "hidden" },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: Theme.primary },
  checklistRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  checklistText: { fontSize: 11, color: Theme.mutedForeground },

  /* Tab bar */
  tabBarScroll: { flexGrow: 0, marginHorizontal: 16, marginBottom: 12 },
  tabBarContent: { borderRadius: 8, backgroundColor: Theme.muted, padding: 4, flexDirection: "row" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 6, paddingVertical: 9 },
  tabActive: { backgroundColor: Theme.card },
  tabText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },

  /* Scroll */
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: Theme.foreground, marginBottom: 4 },

  /* Integration rows */
  integrationRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  integrationLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  integrationName: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  integrationStatus: { fontSize: 12, marginTop: 1 },
  integrationActions: { flexDirection: "row", gap: 8 },

  /* Mini buttons */
  miniBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: Theme.primary, alignItems: "center", justifyContent: "center",
    minWidth: 44,
  },
  miniBtnText: { fontSize: 12, fontWeight: "600", color: Theme.primary },

  /* Flow type cards */
  flowTypeCard: {
    padding: 12, borderRadius: 8, borderWidth: 1,
    borderColor: Theme.border, backgroundColor: Theme.muted, marginBottom: 8,
  },
  flowTypeCardActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.08)" },
  flowTypeHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  flowTypeLabel: { fontSize: 15, fontWeight: "600", color: Theme.foreground },
  flowTypeDesc: { fontSize: 12, color: Theme.mutedForeground, marginLeft: 30 },

  /* Fields */
  fieldGroup: { marginBottom: 10 },
  fieldLabel: { marginBottom: 4, fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  input: {
    borderRadius: 8, borderWidth: 1, borderColor: Theme.border,
    backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 10,
    color: Theme.foreground, fontSize: 15,
  },

  /* Buttons */
  saveBtn: { borderRadius: 8, backgroundColor: Theme.primary, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  outlineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Theme.primary,
    paddingVertical: 10, marginTop: 4,
  },
  outlineBtnText: { fontSize: 14, fontWeight: "600", color: Theme.primary },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(212,9,36,0.4)",
    backgroundColor: "rgba(212,9,36,0.08)", paddingVertical: 12,
  },
  dangerBtnText: { fontSize: 14, fontWeight: "600", color: Theme.destructive },

  /* Credentials */
  providerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  credIconBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.muted },

  /* Toggles */
  toggleRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  toggleLabel: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  toggleDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },

  /* Info rows */
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },

  /* Common */
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", color: Theme.primaryLight },
  nameText: { fontWeight: "500", color: Theme.foreground },
  subText: { fontSize: 13, color: Theme.mutedForeground },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  emptyText: { fontSize: 14, color: Theme.mutedForeground, textAlign: "center", paddingVertical: 16 },

  /* Users */
  userRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },

  /* Campaigns */
  campaignRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },

  /* Events */
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted,
  },
  filterChipActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.15)" },
  filterChipText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  filterChipTextActive: { color: Theme.primary },
  eventHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventType: { fontSize: 14, fontWeight: "600", color: Theme.foreground },
  eventTime: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  eventMessage: { fontSize: 13, color: Theme.mutedForeground, marginTop: 4 },
  sourceChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    backgroundColor: Theme.primaryMuted,
  },
  sourceChipText: { fontSize: 11, fontWeight: "500", color: Theme.primaryLight },
  metadataBox: {
    marginTop: 8, padding: 10, borderRadius: 6,
    backgroundColor: Theme.muted, borderWidth: 1, borderColor: Theme.border,
  },
  metadataText: { fontSize: 12, color: Theme.mutedForeground, fontFamily: "monospace" },

  /* Demo */
  demoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  demoBtn: {
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    width: "30%" as any, paddingVertical: 16, borderRadius: 10,
    borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted, gap: 6,
  },
  demoBtnText: { fontSize: 11, fontWeight: "500", color: Theme.foreground, textAlign: "center" },
  resetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(212,9,36,0.3)", backgroundColor: "rgba(212,9,36,0.08)",
  },
  resetBtnText: { fontSize: 13, fontWeight: "500", color: Theme.red400 },
});
