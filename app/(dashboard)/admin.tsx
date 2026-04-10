import React, { useState } from "react";
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Alert, TextInput, StyleSheet, Switch, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchSettings, updateSettings, fetchTeams, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { Cleaner, TenantSettings } from "@/types";

const TEST_PERSONS = [
  { name: "Dominic", phone: "4242755847" },
  { name: "Daniel", phone: "4243270461" },
  { name: "Jack", phone: "4157204580", email: "JasperGrenager@gmail.com" },
];

type Tab = "controls" | "settings" | "cleaners" | "tenant" | "credentials" | "onboard";

/* ── Credential schema ── */
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
];

const FLOW_OPTIONS: { label: string; value: string }[] = [
  { label: "Inbound", value: "inbound" },
  { label: "Outbound", value: "outbound" },
  { label: "Both", value: "both" },
];

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("controls");
  const { tenant, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [resettingPerson, setResettingPerson] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});

  /* credentials tab state */
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [credSaving, setCredSaving] = useState(false);
  const [credTesting, setCredTesting] = useState(false);
  const [credResult, setCredResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }> | null>(null);
  const [providerTesting, setProviderTesting] = useState<string | null>(null);
  const [registeringWebhooks, setRegisteringWebhooks] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [cloningVapi, setCloningVapi] = useState(false);
  const [cloneResult, setCloneResult] = useState<{ success: boolean; message: string } | null>(null);

  /* onboard tab state */
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardData, setOnboardData] = useState<Record<string, string>>({
    business_name: "",
    slug: "",
    password: "",
    flow_type: "inbound",
  });
  const [onboardCreds, setOnboardCreds] = useState<Record<string, string>>({});
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardResult, setOnboardResult] = useState<{ success: boolean; message: string } | null>(null);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: activeTab === "cleaners" });

  const settings: TenantSettings = (settingsQuery.data as any)?.settings ?? (settingsQuery.data as any)?.data?.settings ?? {};
  const cleaners: Cleaner[] = (teamsQuery.data as any)?.data?.cleaners ?? (teamsQuery.data as any)?.cleaners ?? (teamsQuery.data as any)?.data ?? [];

  const settingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const resetPerson = async (person: typeof TEST_PERSONS[0]) => {
    setResettingPerson(person.name);
    setResetResult(null);
    try {
      await apiFetch("/api/admin/reset-customer", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: person.phone, email: (person as any).email, crossTenant: true }),
      });
      setResetResult({ success: true, message: `${person.name} reset successfully` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setResetResult({ success: false, message: err.message });
    } finally {
      setResettingPerson(null);
    }
  };

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

  const onRefresh = async () => {
    await Promise.all([settingsQuery.refetch(), teamsQuery.refetch()]);
  };

  /* ── Credentials helpers ── */
  const maskValue = (val: string | undefined) => {
    if (!val) return "";
    if (val.length <= 4) return val;
    return "\u2022".repeat(val.length - 4) + val.slice(-4);
  };

  const toggleReveal = (key: string) =>
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));

  const saveCredentials = async () => {
    setCredSaving(true);
    setCredResult(null);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "PATCH",
        body: JSON.stringify({ tenantId: tenant?.id, credentials }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCredResult({ success: true, message: "Credentials saved" });
    } catch (err: any) {
      setCredResult({ success: false, message: err.message });
    } finally {
      setCredSaving(false);
    }
  };

  const testConnections = async () => {
    setCredTesting(true);
    setTestResults(null);
    try {
      const res: any = await apiFetch("/api/admin/test-connections", {
        method: "POST",
      });
      const results = res?.data?.results ?? res?.results ?? {};
      setTestResults(results);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setTestResults({ _error: { ok: false, message: err.message } });
    } finally {
      setCredTesting(false);
    }
  };

  /* ── Per-provider test ── */
  const testProvider = async (provider: string) => {
    setProviderTesting(provider);
    try {
      const res: any = await apiFetch("/api/admin/test-connections", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      const results = res?.data?.results ?? res?.results ?? {};
      // Merge individual provider result into full test results
      setTestResults((prev) => ({ ...(prev ?? {}), ...results }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setTestResults((prev) => ({
        ...(prev ?? {}),
        [provider.toLowerCase()]: { ok: false, message: err.message },
      }));
    } finally {
      setProviderTesting(null);
    }
  };

  /* ── Register Webhooks ── */
  const registerWebhooks = () => {
    Alert.alert(
      "Register Webhooks",
      "This will register webhook endpoints for all services. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Register",
          onPress: async () => {
            setRegisteringWebhooks(true);
            setWebhookResult(null);
            try {
              const res: any = await apiFetch("/api/admin/register-webhook", {
                method: "POST",
                body: JSON.stringify({ service: "all" }),
              });
              const details = res?.data ?? res ?? {};
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setWebhookResult({
                success: true,
                message: "Webhooks registered successfully",
                details,
              });
            } catch (err: any) {
              setWebhookResult({ success: false, message: err.message });
            } finally {
              setRegisteringWebhooks(false);
            }
          },
        },
      ]
    );
  };

  /* ── Clone VAPI Assistants ── */
  const cloneVapiAssistants = async () => {
    setCloningVapi(true);
    setCloneResult(null);
    try {
      const res: any = await apiFetch("/api/admin/clone-vapi-assistants", {
        method: "POST",
        body: JSON.stringify({
          vapi_api_key: onboardCreds.vapi_api_key,
          flow_type: onboardData.flow_type,
          slug: onboardData.slug,
          business_name: onboardData.business_name,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCloneResult({
        success: true,
        message: res?.message ?? "VAPI assistants cloned successfully",
      });
    } catch (err: any) {
      setCloneResult({ success: false, message: err.message });
    } finally {
      setCloningVapi(false);
    }
  };

  /* ── Onboard helpers ── */
  const submitOnboard = async () => {
    setOnboardLoading(true);
    setOnboardResult(null);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ ...onboardData, credentials: onboardCreds }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOnboardResult({ success: true, message: "Tenant created successfully" });
    } catch (err: any) {
      setOnboardResult({ success: false, message: err.message });
    } finally {
      setOnboardLoading(false);
    }
  };

  if (settingsQuery.isLoading) return <LoadingScreen message="Loading admin..." />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "controls", label: "Controls" },
    { key: "settings", label: "Settings" },
    { key: "cleaners", label: "Cleaners" },
    { key: "tenant", label: "Info" },
    { key: "credentials", label: "Credentials" },
    { key: "onboard", label: "Onboard" },
  ];

  return (
    <View style={s.container}>
      {/* Reset Buttons */}
      <View style={s.resetRow}>
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
              <Ionicons name="refresh" size={14} color={Theme.red400} />
            )}
            <Text style={s.resetBtnText}>
              {resettingPerson === person.name ? "Resetting..." : `Reset ${person.name}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reset result banner */}
      {resetResult && (
        <View style={[s.resultBanner, { borderColor: resetResult.success ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)", backgroundColor: resetResult.success ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
          <Text style={{ color: resetResult.success ? Theme.success : Theme.destructive, fontSize: 13 }}>{resetResult.message}</Text>
        </View>
      )}

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBarContent}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tab, activeTab === tab.key && s.tabActive]}>
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={settingsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />}>

        {/* Controls Tab */}
        {activeTab === "controls" && (
          <View style={s.section}>
            <GlassCard>
              <Text style={s.sectionTitle}>System Controls</Text>
              <ToggleRow
                label="SMS Auto-Response"
                description="AI responds to incoming messages automatically"
                value={tenant?.workflow_config?.sms_auto_response_enabled ?? false}
                onToggle={(v) => toggleTenantField("sms_auto_response_enabled", v)}
              />
              <ToggleRow
                label="Business Active"
                description="When off, all automated systems are paused"
                value={tenant?.active ?? true}
                onToggle={(v) => toggleTenantField("active", v)}
              />
              <ToggleRow
                label="Auto Cleaner Assignment"
                description="Automatically assign cleaners to new jobs"
                value={tenant?.workflow_config?.cleaner_assignment_auto ?? false}
                onToggle={(v) => toggleTenantField("cleaner_assignment_auto", v)}
              />
              <ToggleRow
                label="Lead Followup"
                description={`${tenant?.workflow_config?.lead_followup_stages ?? 0} stages`}
                value={tenant?.workflow_config?.lead_followup_enabled ?? false}
                onToggle={(v) => toggleTenantField("lead_followup_enabled", v)}
              />
              <ToggleRow
                label="Require Deposit"
                description={`${tenant?.workflow_config?.deposit_percentage ?? 0}% of job value`}
                value={tenant?.workflow_config?.require_deposit ?? false}
                onToggle={(v) => toggleTenantField("require_deposit", v)}
              />
            </GlassCard>
          </View>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <View style={s.section}>
            <GlassCard>
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
          </View>
        )}

        {/* Cleaners Tab */}
        {activeTab === "cleaners" && (
          <View style={s.section}>
            {cleaners.map((cleaner, i) => (
              <GlassCard key={cleaner.id || i} style={{ marginBottom: 8 }}>
                <View style={s.row}>
                  <View style={s.avatar}><Text style={s.avatarText}>{cleaner.name?.[0]?.toUpperCase()}</Text></View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={s.nameText}>{cleaner.name}</Text>
                    <Text style={s.subText}>{cleaner.phone || cleaner.email || ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={[s.badge, { backgroundColor: cleaner.active ? Theme.successBg : Theme.destructiveBg }]}>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: cleaner.active ? Theme.success : Theme.destructive }}>
                        {cleaner.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Info Tab */}
        {activeTab === "tenant" && (
          <View style={s.section}>
            <GlassCard>
              <Text style={s.sectionTitle}>Tenant Information</Text>
              <InfoRow label="Name" value={tenant?.name} />
              <InfoRow label="Business" value={tenant?.business_name} />
              <InfoRow label="Slug" value={tenant?.slug} />
              <InfoRow label="Status" value={tenant?.active ? "Active" : "Inactive"} />
              <InfoRow label="Stripe" value={tenant?.workflow_config?.use_stripe ? "Enabled" : "Disabled"} />
              <InfoRow label="Assignment Mode" value={tenant?.workflow_config?.assignment_mode || "N/A"} />
            </GlassCard>
          </View>
        )}

        {/* Credentials Tab */}
        {activeTab === "credentials" && (
          <View style={s.section}>
            {CREDENTIAL_SECTIONS.map((section) => {
              const providerKey = section.provider.toLowerCase();
              const providerResult = testResults?.[providerKey];
              return (
              <GlassCard key={section.provider} style={{ marginBottom: 12 }}>
                <View style={s.providerHeader}>
                  <Text style={s.sectionTitle}>{section.provider}</Text>
                  <View style={s.providerHeaderRight}>
                    {providerResult && (
                      <Ionicons
                        name={providerResult.ok ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={providerResult.ok ? Theme.success : Theme.destructive}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => testProvider(section.provider)}
                      disabled={providerTesting !== null}
                      style={s.providerTestBtn}
                    >
                      {providerTesting === section.provider ? (
                        <ActivityIndicator size="small" color={Theme.primary} />
                      ) : (
                        <Text style={s.providerTestBtnText}>Test</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {providerResult && (
                  <Text style={{ fontSize: 12, color: providerResult.ok ? Theme.success : Theme.destructive, marginBottom: 8 }}>
                    {providerResult.message}
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
                        <TouchableOpacity onPress={() => toggleReveal(field.key)} style={s.credEditBtn}>
                          <Ionicons
                            name={revealed ? "eye-off-outline" : "create-outline"}
                            size={18}
                            color={Theme.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </GlassCard>
              );
            })}

            {credResult && (
              <View style={[s.resultBanner, { borderColor: credResult.success ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)", backgroundColor: credResult.success ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
                <Text style={{ color: credResult.success ? Theme.success : Theme.destructive, fontSize: 13 }}>{credResult.message}</Text>
              </View>
            )}

            {testResults && (
              <GlassCard style={{ marginBottom: 12 }}>
                <Text style={s.sectionTitle}>Connection Test Results</Text>
                {Object.entries(testResults).map(([key, result]) => (
                  <View key={key} style={s.testResultRow}>
                    <Ionicons
                      name={result.ok ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={result.ok ? Theme.success : Theme.destructive}
                    />
                    <Text style={[s.testResultText, { color: result.ok ? Theme.success : Theme.destructive }]}>
                      {key}: {result.message}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            )}

            <View style={s.credBtnRow}>
              <TouchableOpacity onPress={saveCredentials} disabled={credSaving} style={[s.saveBtn, { flex: 1 }]}>
                {credSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save Credentials</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={testConnections} disabled={credTesting} style={[s.testBtn, { flex: 1 }]}>
                {credTesting ? (
                  <ActivityIndicator size="small" color={Theme.primary} />
                ) : (
                  <Text style={s.testBtnText}>Test Connections</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Register Webhooks */}
            <TouchableOpacity
              onPress={registerWebhooks}
              disabled={registeringWebhooks}
              style={[s.webhookBtn, registeringWebhooks && { opacity: 0.5 }]}
            >
              {registeringWebhooks ? (
                <ActivityIndicator size="small" color={Theme.warning} />
              ) : (
                <Ionicons name="link-outline" size={18} color={Theme.warning} />
              )}
              <Text style={s.webhookBtnText}>Register Webhooks</Text>
            </TouchableOpacity>

            {webhookResult && (
              <GlassCard style={{ marginTop: 8 }}>
                <View style={s.testResultRow}>
                  <Ionicons
                    name={webhookResult.success ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={webhookResult.success ? Theme.success : Theme.destructive}
                  />
                  <Text style={[s.testResultText, { color: webhookResult.success ? Theme.success : Theme.destructive }]}>
                    {webhookResult.message}
                  </Text>
                </View>
                {webhookResult.details && (
                  <View style={{ marginTop: 8 }}>
                    {Object.entries(webhookResult.details).map(([service, info]: [string, any]) => {
                      if (typeof info !== "object" || info === null) return null;
                      return (
                        <View key={service} style={s.webhookHealthRow}>
                          <Text style={s.webhookServiceName}>{service}</Text>
                          {info.registered_at && (
                            <Text style={s.webhookHealthDetail}>
                              Registered: {new Date(info.registered_at).toLocaleDateString()}
                            </Text>
                          )}
                          {info.error_count != null && (
                            <Text style={[s.webhookHealthDetail, info.error_count > 0 && { color: Theme.destructive }]}>
                              Errors: {info.error_count}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </GlassCard>
            )}
          </View>
        )}

        {/* Onboard Tab */}
        {activeTab === "onboard" && (
          <View style={s.section}>
            {/* Step indicators */}
            <View style={s.stepRow}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={[s.stepDot, onboardStep >= step && s.stepDotActive]}>
                  <Text style={[s.stepDotText, onboardStep >= step && s.stepDotTextActive]}>{step}</Text>
                </View>
              ))}
            </View>

            {onboardStep === 1 && (
              <GlassCard>
                <Text style={s.sectionTitle}>Business Details</Text>
                {[
                  { key: "business_name", label: "Business Name", placeholder: "Acme Cleaning Co." },
                  { key: "slug", label: "Slug", placeholder: "acme-cleaning" },
                  { key: "password", label: "Password", placeholder: "Admin password", secure: true },
                ].map((field) => (
                  <View key={field.key} style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>{field.label}</Text>
                    <TextInput
                      value={onboardData[field.key] ?? ""}
                      onChangeText={(v) => setOnboardData((p) => ({ ...p, [field.key]: v }))}
                      style={s.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={Theme.mutedForeground}
                      secureTextEntry={(field as any).secure ?? false}
                      autoCapitalize="none"
                    />
                  </View>
                ))}
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Flow Type</Text>
                  <View style={s.flowRow}>
                    {FLOW_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setOnboardData((p) => ({ ...p, flow_type: opt.value }))}
                        style={[s.flowChip, onboardData.flow_type === opt.value && s.flowChipActive]}
                      >
                        <Text style={[s.flowChipText, onboardData.flow_type === opt.value && s.flowChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setOnboardStep(2)}
                  disabled={!onboardData.business_name || !onboardData.slug || !onboardData.password}
                  style={[s.saveBtn, (!onboardData.business_name || !onboardData.slug || !onboardData.password) && { opacity: 0.5 }]}
                >
                  <Text style={s.saveBtnText}>Next</Text>
                </TouchableOpacity>
              </GlassCard>
            )}

            {onboardStep === 2 && (
              <GlassCard>
                <Text style={s.sectionTitle}>API Credentials</Text>
                {CREDENTIAL_SECTIONS.map((section) => (
                  <View key={section.provider} style={{ marginBottom: 12 }}>
                    <Text style={[s.fieldLabel, { fontSize: 14, fontWeight: "600", marginBottom: 8 }]}>{section.provider}</Text>
                    {section.fields.map((field) => (
                      <View key={field.key} style={s.fieldGroup}>
                        <Text style={s.fieldLabel}>{field.label}</Text>
                        <TextInput
                          value={onboardCreds[field.key] ?? ""}
                          onChangeText={(v) => setOnboardCreds((p) => ({ ...p, [field.key]: v }))}
                          style={s.input}
                          placeholder={`Enter ${field.label}`}
                          placeholderTextColor={Theme.mutedForeground}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    ))}
                  </View>
                ))}
                {/* Clone VAPI Assistants */}
                <TouchableOpacity
                  onPress={cloneVapiAssistants}
                  disabled={cloningVapi || !onboardCreds.vapi_api_key}
                  style={[s.cloneVapiBtn, (!onboardCreds.vapi_api_key || cloningVapi) && { opacity: 0.5 }]}
                >
                  {cloningVapi ? (
                    <ActivityIndicator size="small" color={Theme.info} />
                  ) : (
                    <Ionicons name="copy-outline" size={16} color={Theme.info} />
                  )}
                  <Text style={s.cloneVapiBtnText}>Clone VAPI Assistants</Text>
                </TouchableOpacity>
                {!onboardCreds.vapi_api_key && (
                  <Text style={{ fontSize: 11, color: Theme.mutedForeground, marginTop: 4 }}>
                    Enter a VAPI API Key above to enable cloning
                  </Text>
                )}
                {cloneResult && (
                  <View style={[s.resultBanner, { marginTop: 8, borderColor: cloneResult.success ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)", backgroundColor: cloneResult.success ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
                    <Text style={{ color: cloneResult.success ? Theme.success : Theme.destructive, fontSize: 13 }}>{cloneResult.message}</Text>
                  </View>
                )}

                <View style={[s.credBtnRow, { marginTop: 12 }]}>
                  <TouchableOpacity onPress={() => setOnboardStep(1)} style={[s.testBtn, { flex: 1 }]}>
                    <Text style={s.testBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOnboardStep(3)} style={[s.saveBtn, { flex: 1 }]}>
                    <Text style={s.saveBtnText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            )}

            {onboardStep === 3 && (
              <GlassCard>
                <Text style={s.sectionTitle}>Review & Create</Text>
                <InfoRow label="Business Name" value={onboardData.business_name} />
                <InfoRow label="Slug" value={onboardData.slug} />
                <InfoRow label="Flow Type" value={onboardData.flow_type} />
                <View style={{ marginTop: 8 }}>
                  <Text style={[s.fieldLabel, { fontSize: 14, fontWeight: "600", marginBottom: 4 }]}>Credentials</Text>
                  {CREDENTIAL_SECTIONS.map((section) =>
                    section.fields.map((field) =>
                      onboardCreds[field.key] ? (
                        <InfoRow
                          key={field.key}
                          label={`${section.provider} ${field.label}`}
                          value={"\u2022\u2022\u2022\u2022" + (onboardCreds[field.key]?.slice(-4) ?? "")}
                        />
                      ) : null
                    )
                  )}
                </View>

                {onboardResult && (
                  <View style={[s.resultBanner, { marginTop: 12, borderColor: onboardResult.success ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)", backgroundColor: onboardResult.success ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
                    <Text style={{ color: onboardResult.success ? Theme.success : Theme.destructive, fontSize: 13 }}>{onboardResult.message}</Text>
                  </View>
                )}

                <View style={[s.credBtnRow, { marginTop: 12 }]}>
                  <TouchableOpacity onPress={() => setOnboardStep(2)} style={[s.testBtn, { flex: 1 }]}>
                    <Text style={s.testBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submitOnboard} disabled={onboardLoading} style={[s.saveBtn, { flex: 1 }]}>
                    {onboardLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.saveBtnText}>Create Tenant</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </GlassCard>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  resetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(212,9,36,0.3)", backgroundColor: "rgba(212,9,36,0.1)",
  },
  resetBtnText: { fontSize: 12, fontWeight: "500", color: Theme.red400 },
  resultBanner: {
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1,
  },
  tabBarScroll: { flexGrow: 0, marginHorizontal: 16, marginBottom: 12 },
  tabBarContent: { borderRadius: 8, backgroundColor: Theme.muted, padding: 4, flexDirection: "row" },
  tab: { paddingHorizontal: 14, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  tabActive: { backgroundColor: Theme.card },
  tabText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  scrollContent: { paddingBottom: 32 },
  section: { paddingHorizontal: 16, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { marginBottom: 4, fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  input: { borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 10, color: Theme.foreground, fontSize: 15 },
  saveBtn: { borderRadius: 8, backgroundColor: Theme.primary, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  testBtn: { borderRadius: 8, borderWidth: 1, borderColor: Theme.primary, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  testBtnText: { color: Theme.primary, fontWeight: "600", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", color: Theme.primaryLight },
  nameText: { fontWeight: "500", color: Theme.foreground },
  subText: { fontSize: 13, color: Theme.mutedForeground },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  toggleLabel: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  toggleDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  credEditBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.muted },
  credBtnRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  testResultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  testResultText: { fontSize: 13, fontWeight: "500" },
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 12 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Theme.border },
  stepDotActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  stepDotText: { fontSize: 14, fontWeight: "600", color: Theme.mutedForeground },
  stepDotTextActive: { color: "#fff" },
  flowRow: { flexDirection: "row", gap: 8 },
  flowChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted },
  flowChipActive: { borderColor: Theme.primary, backgroundColor: "rgba(0,145,255,0.15)" },
  flowChipText: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground },
  flowChipTextActive: { color: Theme.primary },
  /* ── Provider header ── */
  providerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  providerHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  providerTestBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Theme.primary, minWidth: 50, alignItems: "center" },
  providerTestBtnText: { fontSize: 12, fontWeight: "600", color: Theme.primary },
  /* ── Webhook ── */
  webhookBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.1)",
    paddingVertical: 12,
  },
  webhookBtnText: { fontSize: 14, fontWeight: "600", color: Theme.warning },
  webhookHealthRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  webhookServiceName: { fontSize: 13, fontWeight: "600", color: Theme.foreground, textTransform: "capitalize" },
  webhookHealthDetail: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  /* ── Clone VAPI ── */
  cloneVapiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)", backgroundColor: "rgba(59,130,246,0.1)",
    paddingVertical: 12,
  },
  cloneVapiBtnText: { fontSize: 14, fontWeight: "600", color: Theme.info },
});
