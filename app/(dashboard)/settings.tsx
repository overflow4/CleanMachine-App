import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchSettings,
  updateSettings,
  fetchPricing,
  fetchPricingAddons,
  adminTestConnection,
  adminRegisterWebhook,
  adminCloneVapi,
  adminOnboard,
} from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton, ToggleField } from "@/components/ui/FormField";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
import { TenantSettings } from "@/types";

// ===== Types =====

interface PricingTier {
  id: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  price: string;
  labor_hours: string;
}

interface AddOn {
  id: string;
  name: string;
  price: string;
}

interface FlatService {
  id: string;
  name: string;
  price: string;
}

type Tab = "business" | "services" | "credentials" | "integrations";

const generateId = () => Math.random().toString(36).substring(2, 10);

// ===== Helpers =====

function parseTiers(raw: unknown): PricingTier[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((t: any) => ({
      id: t.id || generateId(),
      bedrooms: String(t.bedrooms ?? ""),
      bathrooms: String(t.bathrooms ?? ""),
      sqft: String(t.sqft ?? ""),
      price: String(t.price ?? ""),
      labor_hours: String(t.labor_hours ?? ""),
    }));
  } catch {
    return [];
  }
}

function parseAddOns(raw: unknown): AddOn[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((a: any) => ({
      id: a.id || generateId(),
      name: String(a.name ?? ""),
      price: String(a.price ?? ""),
    }));
  } catch {
    return [];
  }
}

function parseFlatServices(raw: unknown): FlatService[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      id: s.id || generateId(),
      name: String(s.name ?? ""),
      price: String(s.price ?? ""),
    }));
  } catch {
    return [];
  }
}

// ===== Business Info Fields =====

const BUSINESS_FIELDS: {
  key: string;
  label: string;
  keyboard?: "numeric" | "email-address" | "url";
}[] = [
  { key: "business_name", label: "Business Name" },
  { key: "service_area", label: "Service Area" },
  { key: "timezone", label: "Timezone" },
  { key: "owner_phone", label: "Owner Phone" },
  { key: "owner_email", label: "Owner Email", keyboard: "email-address" },
  { key: "google_review_link", label: "Google Review Link", keyboard: "url" },
  { key: "business_hours_start", label: "Business Hours Start" },
  { key: "business_hours_end", label: "Business Hours End" },
  {
    key: "buffer_minutes",
    label: "Buffer Minutes Between Jobs",
    keyboard: "numeric",
  },
];

// ===== Credential fields =====

const CREDENTIAL_FIELDS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "openphone_api_key", label: "OpenPhone API Key", icon: "call-outline" },
  { key: "stripe_secret_key", label: "Stripe Secret Key", icon: "card-outline" },
  { key: "vapi_api_key", label: "VAPI API Key", icon: "mic-outline" },
  { key: "hcp_api_key", label: "HCP API Key", icon: "home-outline" },
  { key: "ghl_api_key", label: "GHL API Key", icon: "megaphone-outline" },
  { key: "wave_api_key", label: "Wave API Key", icon: "water-outline" },
  { key: "gmail_credentials", label: "Gmail Credentials", icon: "mail-outline" },
];

// ===== Integration toggles =====

const INTEGRATION_TOGGLES: {
  key: string;
  label: string;
  description: string;
}[] = [
  {
    key: "use_housecall_pro",
    label: "HCP Sync",
    description: "Sync jobs and customers with HousecallPro",
  },
  {
    key: "use_stripe",
    label: "Payment Collection",
    description: "Collect payments via Stripe",
  },
  {
    key: "cleaner_assignment_auto",
    label: "Team Routing",
    description: "Auto-assign cleaners to jobs",
  },
  {
    key: "lead_followup_enabled",
    label: "Review Requests",
    description: "Auto-send Google review requests after jobs",
  },
  {
    key: "sms_auto_response_enabled",
    label: "SMS Auto-Response",
    description: "AI responds to customer SMS automatically",
  },
  {
    key: "retargeting_enabled",
    label: "Retargeting",
    description: "Re-engage churned customers automatically",
  },
  {
    key: "use_route_optimization",
    label: "Route Optimization",
    description: "Optimize daily job routes for efficiency",
  },
];

const BOOKING_FLOW_OPTIONS = [
  { key: "winbros", label: "Winbros" },
  { key: "spotless", label: "Spotless" },
  { key: "cedar", label: "Cedar" },
] as const;

// ===== Main Component =====

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("business");

  // Business Info state
  const [businessEdits, setBusinessEdits] = useState<Record<string, string>>(
    {}
  );

  // Service Editor state
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [flatServices, setFlatServices] = useState<FlatService[]>([]);
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [addOnModalVisible, setAddOnModalVisible] = useState(false);
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
  const [flatModalVisible, setFlatModalVisible] = useState(false);
  const [editingFlat, setEditingFlat] = useState<FlatService | null>(null);
  const [servicesDirty, setServicesDirty] = useState(false);

  // Credentials state
  const [credentialEdits, setCredentialEdits] = useState<
    Record<string, string>
  >({});
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);

  // Integrations state
  const [integrationEdits, setIntegrationEdits] = useState<
    Record<string, boolean>
  >({});
  const [integrationsDirty, setIntegrationsDirty] = useState(false);

  // Onboarding wizard
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [onboardData, setOnboardData] = useState<Record<string, string>>({});

  // Deposit / Booking flow
  const [depositPct, setDepositPct] = useState("");
  const [bookingFlow, setBookingFlow] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const settings: TenantSettings = (data as any)?.settings ?? {};

  // Sync state when data loads
  useEffect(() => {
    if (settings) {
      setTiers(parseTiers((settings as any).pricing_tiers));
      setAddOns(parseAddOns((settings as any).add_ons));
      setFlatServices(parseFlatServices((settings as any).flat_services));
      setServicesDirty(false);
      setDepositPct(String((settings as any).deposit_percentage ?? ""));
      setBookingFlow(String((settings as any).booking_flow ?? ""));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSettings(payload),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setBusinessEdits({});
      setServicesDirty(false);
      setCredentialEdits({});
      setIntegrationsDirty(false);
      Alert.alert("Success", "Settings saved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const onboardMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminOnboard(payload),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setShowOnboarding(false);
      setOnboardStep(0);
      setOnboardData({});
      Alert.alert("Success", "Onboarding complete!");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const cloneVapiMutation = useMutation({
    mutationFn: () => adminCloneVapi({}),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "VAPI assistants cloned successfully");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // ===== Business Info Handlers =====

  const handleBusinessSave = useCallback(() => {
    const payload: Record<string, unknown> = { ...businessEdits };
    if (depositPct !== String((settings as any).deposit_percentage ?? "")) {
      payload.deposit_percentage = Number(depositPct) || 0;
    }
    if (bookingFlow !== String((settings as any).booking_flow ?? "")) {
      payload.booking_flow = bookingFlow;
    }
    if (Object.keys(payload).length === 0) return;
    saveMutation.mutate(payload);
  }, [businessEdits, depositPct, bookingFlow, settings]);

  const hasBusinessChanges =
    Object.keys(businessEdits).length > 0 ||
    depositPct !== String((settings as any).deposit_percentage ?? "") ||
    bookingFlow !== String((settings as any).booking_flow ?? "");

  // ===== Service Editor Handlers =====

  const openAddTier = () => {
    setEditingTier({
      id: generateId(),
      bedrooms: "",
      bathrooms: "",
      sqft: "",
      price: "",
      labor_hours: "",
    });
    setTierModalVisible(true);
  };

  const openEditTier = (tier: PricingTier) => {
    setEditingTier({ ...tier });
    setTierModalVisible(true);
  };

  const saveTier = () => {
    if (!editingTier) return;
    setTiers((prev) => {
      const idx = prev.findIndex((t) => t.id === editingTier.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingTier;
        return updated;
      }
      return [...prev, editingTier];
    });
    setTierModalVisible(false);
    setEditingTier(null);
    setServicesDirty(true);
  };

  const deleteTier = (id: string) => {
    Alert.alert("Delete Tier", "Remove this pricing tier?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setTiers((prev) => prev.filter((t) => t.id !== id));
          setServicesDirty(true);
        },
      },
    ]);
  };

  const openAddAddOn = () => {
    setEditingAddOn({ id: generateId(), name: "", price: "" });
    setAddOnModalVisible(true);
  };

  const openEditAddOn = (addon: AddOn) => {
    setEditingAddOn({ ...addon });
    setAddOnModalVisible(true);
  };

  const saveAddOn = () => {
    if (!editingAddOn) return;
    setAddOns((prev) => {
      const idx = prev.findIndex((a) => a.id === editingAddOn.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingAddOn;
        return updated;
      }
      return [...prev, editingAddOn];
    });
    setAddOnModalVisible(false);
    setEditingAddOn(null);
    setServicesDirty(true);
  };

  const deleteAddOn = (id: string) => {
    Alert.alert("Delete Add-on", "Remove this add-on?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setAddOns((prev) => prev.filter((a) => a.id !== id));
          setServicesDirty(true);
        },
      },
    ]);
  };

  const openAddFlat = () => {
    setEditingFlat({ id: generateId(), name: "", price: "" });
    setFlatModalVisible(true);
  };

  const openEditFlat = (svc: FlatService) => {
    setEditingFlat({ ...svc });
    setFlatModalVisible(true);
  };

  const saveFlat = () => {
    if (!editingFlat) return;
    setFlatServices((prev) => {
      const idx = prev.findIndex((s) => s.id === editingFlat.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingFlat;
        return updated;
      }
      return [...prev, editingFlat];
    });
    setFlatModalVisible(false);
    setEditingFlat(null);
    setServicesDirty(true);
  };

  const deleteFlat = (id: string) => {
    Alert.alert("Delete Service", "Remove this flat service?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setFlatServices((prev) => prev.filter((s) => s.id !== id));
          setServicesDirty(true);
        },
      },
    ]);
  };

  const handleServicesSave = useCallback(() => {
    saveMutation.mutate({
      pricing_tiers: JSON.stringify(tiers),
      add_ons: JSON.stringify(addOns),
      flat_services: JSON.stringify(flatServices),
    });
  }, [tiers, addOns, flatServices]);

  // ===== Credentials Handlers =====

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTestConnection = async (key: string) => {
    setTestingKey(key);
    try {
      const result = await adminTestConnection({ service: key });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Connection Test",
        (result as any)?.message || (result as any)?.success
          ? "Connection successful!"
          : "Test completed."
      );
    } catch (err: any) {
      Alert.alert("Connection Failed", err.message);
    } finally {
      setTestingKey(null);
    }
  };

  const handleRegisterWebhook = async (key: string) => {
    setRegisteringKey(key);
    try {
      const result = await adminRegisterWebhook({ service: key });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Webhook",
        (result as any)?.message || "Webhook registered successfully!"
      );
    } catch (err: any) {
      Alert.alert("Failed", err.message);
    } finally {
      setRegisteringKey(null);
    }
  };

  const handleCredentialsSave = () => {
    if (Object.keys(credentialEdits).length === 0) return;
    saveMutation.mutate(credentialEdits);
  };

  // ===== Integrations Handlers =====

  const handleIntegrationToggle = (key: string, value: boolean) => {
    setIntegrationEdits((prev) => ({ ...prev, [key]: value }));
    setIntegrationsDirty(true);
  };

  const handleIntegrationsSave = () => {
    if (!integrationsDirty) return;
    saveMutation.mutate(integrationEdits);
  };

  // ===== Onboarding =====

  const onboardSteps = [
    {
      title: "Business Info",
      fields: [
        { key: "business_name", label: "Business Name" },
        { key: "service_area", label: "Service Area" },
        { key: "owner_phone", label: "Owner Phone" },
        { key: "owner_email", label: "Owner Email" },
        { key: "timezone", label: "Timezone" },
      ],
    },
    {
      title: "Credentials",
      fields: [
        { key: "openphone_api_key", label: "OpenPhone API Key" },
        { key: "stripe_secret_key", label: "Stripe Secret Key" },
        { key: "vapi_api_key", label: "VAPI API Key" },
        { key: "hcp_api_key", label: "HCP API Key" },
      ],
    },
    {
      title: "Review & Execute",
      fields: [],
    },
  ];

  // ===== Loading =====

  if (isLoading) return <LoadingScreen message="Loading settings..." />;

  // ===== Tab definitions =====

  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "business", label: "Business", icon: "business-outline" },
    { key: "services", label: "Services", icon: "pricetags-outline" },
    { key: "credentials", label: "Credentials", icon: "key-outline" },
    { key: "integrations", label: "Integrations", icon: "git-network-outline" },
  ];

  // ===== Render =====

  return (
    <View style={styles.container}>
      {/* Tab Bar - scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={
                activeTab === t.key
                  ? Theme.primary
                  : Theme.mutedForeground
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === t.key && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Theme.primary}
          />
        }
      >
        {activeTab === "business" ? (
          /* ===== BUSINESS INFO TAB ===== */
          <View style={styles.tabContent}>
            <GlassCard>
              <Text style={styles.sectionTitle}>Business Settings</Text>
              {BUSINESS_FIELDS.map((field) => (
                <InputField
                  key={field.key}
                  label={field.label}
                  defaultValue={String((settings as any)[field.key] ?? "")}
                  onChangeText={(v) =>
                    setBusinessEdits((prev) => ({
                      ...prev,
                      [field.key]: v,
                    }))
                  }
                  keyboardType={field.keyboard ?? "default"}
                  autoCapitalize={
                    field.keyboard === "email-address" ||
                    field.keyboard === "url"
                      ? "none"
                      : "sentences"
                  }
                />
              ))}
            </GlassCard>

            {/* Deposit + Booking flow */}
            <GlassCard>
              <Text style={styles.sectionTitle}>Payment & Booking</Text>
              <InputField
                label="Deposit Percentage (%)"
                value={depositPct}
                onChangeText={setDepositPct}
                keyboardType="numeric"
                placeholder="e.g. 50"
              />
              <Text style={styles.fieldLabel}>Booking Flow Type</Text>
              <View style={styles.bookingFlowRow}>
                {BOOKING_FLOW_OPTIONS.map((opt) => {
                  const active = bookingFlow === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.bookingFlowBtn,
                        active && styles.bookingFlowBtnActive,
                      ]}
                      onPress={() => setBookingFlow(opt.key)}
                    >
                      <Text
                        style={[
                          styles.bookingFlowBtnText,
                          active && styles.bookingFlowBtnTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {hasBusinessChanges && (
              <View style={styles.saveRow}>
                <ActionButton
                  title="Save Changes"
                  onPress={handleBusinessSave}
                  loading={saveMutation.isPending}
                />
              </View>
            )}

            {/* Onboarding wizard button */}
            <TouchableOpacity
              style={styles.onboardBtn}
              onPress={() => {
                setOnboardStep(0);
                setOnboardData({});
                setShowOnboarding(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.onboardBtnIcon}>
                <Ionicons
                  name="rocket-outline"
                  size={20}
                  color={Theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.onboardBtnTitle}>
                  Onboarding Wizard
                </Text>
                <Text style={styles.onboardBtnDesc}>
                  Set up a new tenant in 3 steps
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Theme.zinc500}
              />
            </TouchableOpacity>
          </View>
        ) : activeTab === "services" ? (
          /* ===== SERVICE EDITOR TAB ===== */
          <View style={styles.servicesContainer}>
            {/* Pricing Tiers */}
            <GlassCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pricing Tiers</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={openAddTier}
                >
                  <Ionicons
                    name="add-circle"
                    size={22}
                    color={Theme.primary}
                  />
                  <Text style={styles.addButtonText}>Add Tier</Text>
                </TouchableOpacity>
              </View>
              {tiers.length === 0 ? (
                <Text style={styles.emptyText}>
                  No pricing tiers configured.
                </Text>
              ) : (
                tiers.map((tier) => (
                  <Pressable
                    key={tier.id}
                    style={styles.listItem}
                    onPress={() => openEditTier(tier)}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        {tier.bedrooms}bd / {tier.bathrooms}ba
                      </Text>
                      <Text style={styles.listItemSubtitle}>
                        {tier.sqft ? `${tier.sqft} sqft` : "No sqft"} |{" "}
                        {tier.labor_hours}h labor
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${tier.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteTier(tier.id)}
                        hitSlop={{
                          top: 10,
                          bottom: 10,
                          left: 10,
                          right: 10,
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={Theme.destructive}
                        />
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))
              )}
            </GlassCard>

            {/* Add-ons */}
            <GlassCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Add-ons</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={openAddAddOn}
                >
                  <Ionicons
                    name="add-circle"
                    size={22}
                    color={Theme.primary}
                  />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {addOns.length === 0 ? (
                <Text style={styles.emptyText}>
                  No add-ons configured.
                </Text>
              ) : (
                addOns.map((addon) => (
                  <Pressable
                    key={addon.id}
                    style={styles.listItem}
                    onPress={() => openEditAddOn(addon)}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        {addon.name || "Untitled"}
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${addon.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteAddOn(addon.id)}
                        hitSlop={{
                          top: 10,
                          bottom: 10,
                          left: 10,
                          right: 10,
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={Theme.destructive}
                        />
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))
              )}
            </GlassCard>

            {/* Flat Services */}
            <GlassCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Flat Services</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={openAddFlat}
                >
                  <Ionicons
                    name="add-circle"
                    size={22}
                    color={Theme.primary}
                  />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {flatServices.length === 0 ? (
                <Text style={styles.emptyText}>
                  No flat services configured.
                </Text>
              ) : (
                flatServices.map((svc) => (
                  <Pressable
                    key={svc.id}
                    style={styles.listItem}
                    onPress={() => openEditFlat(svc)}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        {svc.name || "Untitled"}
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${svc.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteFlat(svc.id)}
                        hitSlop={{
                          top: 10,
                          bottom: 10,
                          left: 10,
                          right: 10,
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={Theme.destructive}
                        />
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))
              )}
            </GlassCard>

            {servicesDirty && (
              <View style={styles.saveServicesRow}>
                <ActionButton
                  title="Save All Service Changes"
                  onPress={handleServicesSave}
                  loading={saveMutation.isPending}
                />
              </View>
            )}
          </View>
        ) : activeTab === "credentials" ? (
          /* ===== CREDENTIALS TAB ===== */
          <View style={styles.tabContent}>
            <GlassCard>
              <Text style={styles.sectionTitle}>API Credentials</Text>
              <Text style={styles.sectionDesc}>
                Manage API keys for connected services. Keys are stored
                encrypted.
              </Text>
            </GlassCard>

            {CREDENTIAL_FIELDS.map((cred) => {
              const currentValue =
                credentialEdits[cred.key] ??
                String((settings as any)[cred.key] ?? "");
              const isRevealed = revealedKeys.has(cred.key);
              const isTesting = testingKey === cred.key;
              const isRegistering = registeringKey === cred.key;
              const hasValue =
                currentValue.length > 0 && currentValue !== "undefined";
              const maskedValue = hasValue
                ? isRevealed
                  ? currentValue
                  : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                : "";

              return (
                <GlassCard key={cred.key}>
                  <View style={styles.credHeader}>
                    <View style={styles.credHeaderLeft}>
                      <View style={styles.credIcon}>
                        <Ionicons
                          name={cred.icon}
                          size={16}
                          color={Theme.primary}
                        />
                      </View>
                      <Text style={styles.credLabel}>{cred.label}</Text>
                    </View>
                    {hasValue && (
                      <View style={styles.credStatusDot}>
                        <View style={styles.credStatusDotInner} />
                      </View>
                    )}
                  </View>

                  <View style={styles.credInputRow}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label=""
                        value={isRevealed ? currentValue : maskedValue}
                        onChangeText={(v) =>
                          setCredentialEdits((prev) => ({
                            ...prev,
                            [cred.key]: v,
                          }))
                        }
                        placeholder="Enter API key..."
                        secureTextEntry={!isRevealed}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.revealBtn}
                      onPress={() => toggleReveal(cred.key)}
                    >
                      <Ionicons
                        name={isRevealed ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={Theme.mutedForeground}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.credActions}>
                    <TouchableOpacity
                      style={[
                        styles.credActionBtn,
                        { backgroundColor: Theme.primaryMuted },
                      ]}
                      onPress={() => handleTestConnection(cred.key)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Text
                          style={[
                            styles.credActionText,
                            { color: Theme.primary },
                          ]}
                        >
                          Testing...
                        </Text>
                      ) : (
                        <>
                          <Ionicons
                            name="flash-outline"
                            size={14}
                            color={Theme.primary}
                          />
                          <Text
                            style={[
                              styles.credActionText,
                              { color: Theme.primary },
                            ]}
                          >
                            Test
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.credActionBtn,
                        { backgroundColor: Theme.successBg },
                      ]}
                      onPress={() => handleRegisterWebhook(cred.key)}
                      disabled={isRegistering}
                    >
                      {isRegistering ? (
                        <Text
                          style={[
                            styles.credActionText,
                            { color: Theme.success },
                          ]}
                        >
                          Registering...
                        </Text>
                      ) : (
                        <>
                          <Ionicons
                            name="link-outline"
                            size={14}
                            color={Theme.success}
                          />
                          <Text
                            style={[
                              styles.credActionText,
                              { color: Theme.success },
                            ]}
                          >
                            Webhook
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}

            {/* VAPI Clone */}
            <GlassCard>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    VAPI Assistants
                  </Text>
                  <Text style={styles.sectionDesc}>
                    Clone VAPI assistant templates to this tenant
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.credActionBtn,
                    { backgroundColor: "rgba(167,139,250,0.15)" },
                  ]}
                  onPress={() => cloneVapiMutation.mutate()}
                  disabled={cloneVapiMutation.isPending}
                >
                  <Ionicons
                    name="copy-outline"
                    size={14}
                    color={Theme.violet400}
                  />
                  <Text
                    style={[
                      styles.credActionText,
                      { color: Theme.violet400 },
                    ]}
                  >
                    {cloneVapiMutation.isPending
                      ? "Cloning..."
                      : "Clone"}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            {Object.keys(credentialEdits).length > 0 && (
              <View style={styles.saveRow}>
                <ActionButton
                  title="Save Credentials"
                  onPress={handleCredentialsSave}
                  loading={saveMutation.isPending}
                />
              </View>
            )}
          </View>
        ) : (
          /* ===== INTEGRATIONS TAB ===== */
          <View style={styles.tabContent}>
            <GlassCard>
              <Text style={styles.sectionTitle}>Integrations</Text>
              <Text style={styles.sectionDesc}>
                Enable or disable automated features
              </Text>
            </GlassCard>

            <GlassCard>
              {INTEGRATION_TOGGLES.map((toggle, idx) => {
                const currentVal =
                  integrationEdits[toggle.key] ??
                  Boolean((settings as any)[toggle.key]);
                return (
                  <View key={toggle.key}>
                    {idx > 0 && <View style={styles.toggleDivider} />}
                    <ToggleField
                      label={toggle.label}
                      description={toggle.description}
                      value={currentVal}
                      onValueChange={(v) =>
                        handleIntegrationToggle(toggle.key, v)
                      }
                    />
                  </View>
                );
              })}
            </GlassCard>

            {integrationsDirty && (
              <View style={styles.saveRow}>
                <ActionButton
                  title="Save Integration Settings"
                  onPress={handleIntegrationsSave}
                  loading={saveMutation.isPending}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ===== MODALS ===== */}

      {/* Pricing Tier Modal */}
      <Modal
        visible={tierModalVisible}
        onClose={() => {
          setTierModalVisible(false);
          setEditingTier(null);
        }}
        title={
          editingTier && tiers.some((t) => t.id === editingTier.id)
            ? "Edit Tier"
            : "Add Tier"
        }
      >
        {editingTier && (
          <>
            <InputField
              label="Bedrooms"
              value={editingTier.bedrooms}
              onChangeText={(v) =>
                setEditingTier((prev) =>
                  prev ? { ...prev, bedrooms: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 3"
            />
            <InputField
              label="Bathrooms"
              value={editingTier.bathrooms}
              onChangeText={(v) =>
                setEditingTier((prev) =>
                  prev ? { ...prev, bathrooms: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 2"
            />
            <InputField
              label="Square Feet"
              value={editingTier.sqft}
              onChangeText={(v) =>
                setEditingTier((prev) =>
                  prev ? { ...prev, sqft: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 1500"
            />
            <InputField
              label="Price ($)"
              value={editingTier.price}
              onChangeText={(v) =>
                setEditingTier((prev) =>
                  prev ? { ...prev, price: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 150"
            />
            <InputField
              label="Labor Hours"
              value={editingTier.labor_hours}
              onChangeText={(v) =>
                setEditingTier((prev) =>
                  prev ? { ...prev, labor_hours: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 2.5"
            />
            <View style={styles.modalActions}>
              <ActionButton title="Save Tier" onPress={saveTier} />
            </View>
          </>
        )}
      </Modal>

      {/* Add-on Modal */}
      <Modal
        visible={addOnModalVisible}
        onClose={() => {
          setAddOnModalVisible(false);
          setEditingAddOn(null);
        }}
        title={
          editingAddOn && addOns.some((a) => a.id === editingAddOn.id)
            ? "Edit Add-on"
            : "Add Add-on"
        }
      >
        {editingAddOn && (
          <>
            <InputField
              label="Add-on Name"
              value={editingAddOn.name}
              onChangeText={(v) =>
                setEditingAddOn((prev) =>
                  prev ? { ...prev, name: v } : prev
                )
              }
              placeholder="e.g. Inside Fridge"
            />
            <InputField
              label="Price ($)"
              value={editingAddOn.price}
              onChangeText={(v) =>
                setEditingAddOn((prev) =>
                  prev ? { ...prev, price: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 35"
            />
            <View style={styles.modalActions}>
              <ActionButton title="Save Add-on" onPress={saveAddOn} />
            </View>
          </>
        )}
      </Modal>

      {/* Flat Service Modal */}
      <Modal
        visible={flatModalVisible}
        onClose={() => {
          setFlatModalVisible(false);
          setEditingFlat(null);
        }}
        title={
          editingFlat &&
          flatServices.some((s) => s.id === editingFlat.id)
            ? "Edit Service"
            : "Add Service"
        }
      >
        {editingFlat && (
          <>
            <InputField
              label="Service Name"
              value={editingFlat.name}
              onChangeText={(v) =>
                setEditingFlat((prev) =>
                  prev ? { ...prev, name: v } : prev
                )
              }
              placeholder="e.g. Move-out Clean"
            />
            <InputField
              label="Price ($)"
              value={editingFlat.price}
              onChangeText={(v) =>
                setEditingFlat((prev) =>
                  prev ? { ...prev, price: v } : prev
                )
              }
              keyboardType="numeric"
              placeholder="e.g. 250"
            />
            <View style={styles.modalActions}>
              <ActionButton title="Save Service" onPress={saveFlat} />
            </View>
          </>
        )}
      </Modal>

      {/* Onboarding Wizard Modal */}
      <Modal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        title={`Onboarding - Step ${onboardStep + 1} of 3`}
      >
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i <= onboardStep && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.stepTitle}>
          {onboardSteps[onboardStep].title}
        </Text>

        {onboardStep < 2 ? (
          /* Steps 1 & 2: form fields */
          <>
            {onboardSteps[onboardStep].fields.map((field) => (
              <InputField
                key={field.key}
                label={field.label}
                value={onboardData[field.key] || ""}
                onChangeText={(v) =>
                  setOnboardData((prev) => ({
                    ...prev,
                    [field.key]: v,
                  }))
                }
                secureTextEntry={field.key.includes("key")}
                autoCapitalize="none"
              />
            ))}
            <View style={styles.wizardNav}>
              {onboardStep > 0 && (
                <ActionButton
                  title="Back"
                  onPress={() => setOnboardStep((s) => s - 1)}
                  variant="outline"
                />
              )}
              <ActionButton
                title="Next"
                onPress={() => setOnboardStep((s) => s + 1)}
                variant="primary"
              />
            </View>
          </>
        ) : (
          /* Step 3: Review */
          <>
            <GlassCard>
              <Text style={styles.reviewTitle}>Review</Text>
              {Object.entries(onboardData).map(([key, value]) => (
                <View key={key} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>
                    {key.replace(/_/g, " ")}
                  </Text>
                  <Text style={styles.reviewValue} numberOfLines={1}>
                    {key.includes("key")
                      ? value
                        ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        : "Not set"
                      : value || "Not set"}
                  </Text>
                </View>
              ))}
            </GlassCard>

            <View style={styles.wizardNav}>
              <ActionButton
                title="Back"
                onPress={() => setOnboardStep((s) => s - 1)}
                variant="outline"
              />
              <ActionButton
                title="Execute Onboarding"
                onPress={() => onboardMutation.mutate(onboardData)}
                variant="primary"
                loading={onboardMutation.isPending}
              />
            </View>
          </>
        )}
      </Modal>
    </View>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  tabBarScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 5,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Theme.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContent: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  sectionDesc: {
    fontSize: 13,
    color: Theme.mutedForeground,
    marginTop: -8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
    marginBottom: 6,
  },
  servicesContainer: {
    gap: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.primary,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.glassListItem,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listItemContent: {
    flex: 1,
    gap: 2,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: Theme.foreground,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.primary,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingVertical: 12,
  },
  saveRow: {
    marginTop: 4,
  },
  saveServicesRow: {
    marginTop: 4,
  },
  modalActions: {
    marginTop: 8,
  },
  // Booking flow
  bookingFlowRow: {
    flexDirection: "row",
    gap: 8,
  },
  bookingFlowBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  bookingFlowBtnActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  bookingFlowBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  bookingFlowBtnTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  // Onboarding button
  onboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.glassCard,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
    borderRadius: 12,
    padding: 16,
  },
  onboardBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  onboardBtnTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
  },
  onboardBtnDesc: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  // Credentials
  credHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  credHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  credIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  credLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  credStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  credStatusDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.success,
  },
  credInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  revealBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  credActions: {
    flexDirection: "row",
    gap: 8,
  },
  credActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  credActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Integrations
  toggleDivider: {
    height: 1,
    backgroundColor: Theme.border,
    marginVertical: 4,
  },
  // Onboarding wizard
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.muted,
  },
  stepDotActive: {
    backgroundColor: Theme.primary,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "center",
    marginBottom: 4,
  },
  wizardNav: {
    gap: 8,
    marginTop: 8,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 4,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  reviewLabel: {
    fontSize: 13,
    color: Theme.mutedForeground,
    textTransform: "capitalize",
    flex: 1,
  },
  reviewValue: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
    textAlign: "right",
  },
});
