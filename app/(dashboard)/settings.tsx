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
import { fetchSettings, updateSettings } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { GlassCard } from "@/components/ui/GlassCard";
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

type Tab = "business" | "services";

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

const BUSINESS_FIELDS: { key: string; label: string; keyboard?: "numeric" | "email-address" | "url" }[] = [
  { key: "business_name", label: "Business Name" },
  { key: "service_area", label: "Service Area" },
  { key: "timezone", label: "Timezone" },
  { key: "owner_phone", label: "Owner Phone" },
  { key: "owner_email", label: "Owner Email", keyboard: "email-address" },
  { key: "google_review_link", label: "Google Review Link", keyboard: "url" },
  { key: "business_hours_start", label: "Business Hours Start" },
  { key: "business_hours_end", label: "Business Hours End" },
  { key: "buffer_minutes", label: "Buffer Minutes Between Jobs", keyboard: "numeric" },
];

// ===== Main Component =====

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("business");

  // Business Info state
  const [businessEdits, setBusinessEdits] = useState<Record<string, string>>({});

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

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const settings: TenantSettings = (data as any)?.settings ?? {};

  // Sync service editor state when data loads
  useEffect(() => {
    if (settings) {
      setTiers(parseTiers((settings as any).pricing_tiers));
      setAddOns(parseAddOns((settings as any).add_ons));
      setFlatServices(parseFlatServices((settings as any).flat_services));
      setServicesDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSettings(payload),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setBusinessEdits({});
      setServicesDirty(false);
      Alert.alert("Success", "Settings saved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // ===== Business Info Handlers =====

  const handleBusinessSave = useCallback(() => {
    if (Object.keys(businessEdits).length === 0) return;
    saveMutation.mutate(businessEdits);
  }, [businessEdits]);

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

  // ===== Loading =====

  if (isLoading) return <LoadingScreen message="Loading settings..." />;

  // ===== Render =====

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "business" && styles.tabActive]}
          onPress={() => setActiveTab("business")}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={activeTab === "business" ? Theme.primary : Theme.mutedForeground}
          />
          <Text style={[styles.tabText, activeTab === "business" && styles.tabTextActive]}>
            Business Info
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "services" && styles.tabActive]}
          onPress={() => setActiveTab("services")}
        >
          <Ionicons
            name="pricetags-outline"
            size={18}
            color={activeTab === "services" ? Theme.primary : Theme.mutedForeground}
          />
          <Text style={[styles.tabText, activeTab === "services" && styles.tabTextActive]}>
            Service Editor
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />
        }
      >
        {activeTab === "business" ? (
          /* ===== BUSINESS INFO TAB ===== */
          <GlassCard>
            <Text style={styles.sectionTitle}>Business Settings</Text>
            {BUSINESS_FIELDS.map((field) => (
              <InputField
                key={field.key}
                label={field.label}
                defaultValue={String((settings as any)[field.key] ?? "")}
                onChangeText={(v) =>
                  setBusinessEdits((prev) => ({ ...prev, [field.key]: v }))
                }
                keyboardType={field.keyboard ?? "default"}
                autoCapitalize={field.keyboard === "email-address" || field.keyboard === "url" ? "none" : "sentences"}
              />
            ))}
            {Object.keys(businessEdits).length > 0 && (
              <View style={styles.saveRow}>
                <ActionButton
                  title="Save Changes"
                  onPress={handleBusinessSave}
                  loading={saveMutation.isPending}
                />
              </View>
            )}
          </GlassCard>
        ) : (
          /* ===== SERVICE EDITOR TAB ===== */
          <View style={styles.servicesContainer}>
            {/* Pricing Tiers */}
            <GlassCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pricing Tiers</Text>
                <TouchableOpacity style={styles.addButton} onPress={openAddTier}>
                  <Ionicons name="add-circle" size={22} color={Theme.primary} />
                  <Text style={styles.addButtonText}>Add Tier</Text>
                </TouchableOpacity>
              </View>
              {tiers.length === 0 ? (
                <Text style={styles.emptyText}>No pricing tiers configured.</Text>
              ) : (
                tiers.map((tier) => (
                  <Pressable key={tier.id} style={styles.listItem} onPress={() => openEditTier(tier)}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        {tier.bedrooms}bd / {tier.bathrooms}ba
                      </Text>
                      <Text style={styles.listItemSubtitle}>
                        {tier.sqft ? `${tier.sqft} sqft` : "No sqft"} | {tier.labor_hours}h labor
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${tier.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteTier(tier.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={Theme.destructive} />
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
                <TouchableOpacity style={styles.addButton} onPress={openAddAddOn}>
                  <Ionicons name="add-circle" size={22} color={Theme.primary} />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {addOns.length === 0 ? (
                <Text style={styles.emptyText}>No add-ons configured.</Text>
              ) : (
                addOns.map((addon) => (
                  <Pressable key={addon.id} style={styles.listItem} onPress={() => openEditAddOn(addon)}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>{addon.name || "Untitled"}</Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${addon.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteAddOn(addon.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={Theme.destructive} />
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
                <TouchableOpacity style={styles.addButton} onPress={openAddFlat}>
                  <Ionicons name="add-circle" size={22} color={Theme.primary} />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {flatServices.length === 0 ? (
                <Text style={styles.emptyText}>No flat services configured.</Text>
              ) : (
                flatServices.map((svc) => (
                  <Pressable key={svc.id} style={styles.listItem} onPress={() => openEditFlat(svc)}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>{svc.name || "Untitled"}</Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.priceText}>${svc.price}</Text>
                      <TouchableOpacity
                        onPress={() => deleteFlat(svc.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={Theme.destructive} />
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))
              )}
            </GlassCard>

            {/* Save Services Button */}
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
        title={editingTier && tiers.some((t) => t.id === editingTier.id) ? "Edit Tier" : "Add Tier"}
      >
        {editingTier && (
          <>
            <InputField
              label="Bedrooms"
              value={editingTier.bedrooms}
              onChangeText={(v) => setEditingTier((prev) => prev ? { ...prev, bedrooms: v } : prev)}
              keyboardType="numeric"
              placeholder="e.g. 3"
            />
            <InputField
              label="Bathrooms"
              value={editingTier.bathrooms}
              onChangeText={(v) => setEditingTier((prev) => prev ? { ...prev, bathrooms: v } : prev)}
              keyboardType="numeric"
              placeholder="e.g. 2"
            />
            <InputField
              label="Square Feet"
              value={editingTier.sqft}
              onChangeText={(v) => setEditingTier((prev) => prev ? { ...prev, sqft: v } : prev)}
              keyboardType="numeric"
              placeholder="e.g. 1500"
            />
            <InputField
              label="Price ($)"
              value={editingTier.price}
              onChangeText={(v) => setEditingTier((prev) => prev ? { ...prev, price: v } : prev)}
              keyboardType="numeric"
              placeholder="e.g. 150"
            />
            <InputField
              label="Labor Hours"
              value={editingTier.labor_hours}
              onChangeText={(v) => setEditingTier((prev) => prev ? { ...prev, labor_hours: v } : prev)}
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
        title={editingAddOn && addOns.some((a) => a.id === editingAddOn.id) ? "Edit Add-on" : "Add Add-on"}
      >
        {editingAddOn && (
          <>
            <InputField
              label="Add-on Name"
              value={editingAddOn.name}
              onChangeText={(v) => setEditingAddOn((prev) => prev ? { ...prev, name: v } : prev)}
              placeholder="e.g. Inside Fridge"
            />
            <InputField
              label="Price ($)"
              value={editingAddOn.price}
              onChangeText={(v) => setEditingAddOn((prev) => prev ? { ...prev, price: v } : prev)}
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
        title={editingFlat && flatServices.some((s) => s.id === editingFlat.id) ? "Edit Service" : "Add Service"}
      >
        {editingFlat && (
          <>
            <InputField
              label="Service Name"
              value={editingFlat.name}
              onChangeText={(v) => setEditingFlat((prev) => prev ? { ...prev, name: v } : prev)}
              placeholder="e.g. Move-out Clean"
            />
            <InputField
              label="Price ($)"
              value={editingFlat.price}
              onChangeText={(v) => setEditingFlat((prev) => prev ? { ...prev, price: v } : prev)}
              keyboardType="numeric"
              placeholder="e.g. 250"
            />
            <View style={styles.modalActions}>
              <ActionButton title="Save Service" onPress={saveFlat} />
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
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Theme.primary,
  },
  tabText: {
    fontSize: 14,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
});
