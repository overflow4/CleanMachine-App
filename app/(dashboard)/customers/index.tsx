import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchCustomers,
  createCustomer,
  batchParseCustomers,
  batchCreateCustomers,
  exportData,
  placesAutocomplete,
} from "@/lib/api";
import { Customer } from "@/types";
import { SearchBar } from "@/components/ui/SearchBar";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { GlassCard } from "@/components/ui/GlassCard";
import { Theme } from "@/constants/colors";

const emptyForm = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  address: "",
  notes: "",
};

const LIFECYCLE_OPTIONS = ["all", "lead", "customer", "churned", "vip"] as const;
const LEAD_SOURCE_OPTIONS = [
  "all",
  "phone",
  "sms",
  "meta",
  "website",
  "vapi",
  "thumbtack",
  "google",
  "google_lsa",
  "manual",
  "email",
  "ghl",
] as const;

type LifecycleFilter = (typeof LIFECYCLE_OPTIONS)[number];
type LeadSourceFilter = (typeof LEAD_SOURCE_OPTIONS)[number];

const LIFECYCLE_COLORS: Record<string, { bg: string; text: string }> = {
  lead: { bg: Theme.infoBg, text: Theme.info },
  customer: { bg: Theme.successBg, text: Theme.success },
  churned: { bg: Theme.destructiveBg, text: Theme.destructive },
  vip: { bg: "rgba(167,139,250,0.15)", text: Theme.violet400 },
};

export default function CustomersScreen() {
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [leadSourceFilter, setLeadSourceFilter] = useState<LeadSourceFilter>("all");

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  // Batch import
  const [batchText, setBatchText] = useState("");
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [batchStep, setBatchStep] = useState<"input" | "preview">("input");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers(search || undefined),
  });

  const raw = data as any;
  const customers: Customer[] =
    raw?.data?.customers ?? raw?.data ?? raw?.customers ?? [];

  // Apply local filters
  const filtered = useMemo(() => {
    let list = customers;
    if (lifecycleFilter !== "all") {
      list = list.filter(
        (c) => (c.lifecycle_stage || "").toLowerCase() === lifecycleFilter
      );
    }
    if (leadSourceFilter !== "all") {
      list = list.filter(
        (c) => (c.lead_source || "").toLowerCase() === leadSourceFilter
      );
    }
    return list;
  }, [customers, lifecycleFilter, leadSourceFilter]);

  const activeFilterCount =
    (lifecycleFilter !== "all" ? 1 : 0) + (leadSourceFilter !== "all" ? 1 : 0);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createCustomer(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowCreateModal(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => {
      Alert.alert("Failed to create customer", err.message);
    },
  });

  const parseMutation = useMutation({
    mutationFn: (text: string) => batchParseCustomers({ text }),
    onSuccess: (data: any) => {
      const parsed = data?.customers ?? data?.data ?? [];
      if (parsed.length === 0) {
        Alert.alert("No Data", "Could not parse any customers from the input.");
        return;
      }
      setParsedCustomers(parsed);
      setBatchStep("preview");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const batchCreateMutation = useMutation({
    mutationFn: (customers: any[]) => batchCreateCustomers({ customers }),
    onSuccess: (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowBatchModal(false);
      setBatchText("");
      setParsedCustomers([]);
      setBatchStep("input");
      const count = data?.created ?? parsedCustomers.length;
      Alert.alert("Success", `${count} customers imported.`);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleCreate = () => {
    if (!form.first_name.trim() && !form.phone_number.trim()) {
      Alert.alert(
        "Required",
        "Please enter at least a first name or phone number."
      );
      return;
    }
    createMutation.mutate(form);
  };

  const handleExport = async () => {
    try {
      const result = await exportData("customers");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Export Ready",
        (result as any)?.message || "Export completed. Check your email."
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleAddressChange = async (text: string) => {
    setForm((prev) => ({ ...prev, address: text }));
    if (text.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    try {
      const result = await placesAutocomplete(text);
      const predictions = (result as any)?.predictions ?? [];
      setAddressSuggestions(predictions);
      setShowAddressSuggestions(predictions.length > 0);
    } catch {
      // silently fail
    }
  };

  const selectAddress = (prediction: any) => {
    setForm((prev) => ({
      ...prev,
      address: prediction.description || prediction.formatted_address || "",
    }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  const updateField = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderCustomer = useCallback(
    ({ item }: { item: Customer }) => {
      const name =
        [item.first_name, item.last_name].filter(Boolean).join(" ") ||
        item.phone_number;
      const stage = (item.lifecycle_stage || "").toLowerCase();
      const lColors = LIFECYCLE_COLORS[stage] || {
        bg: "rgba(113,113,122,0.1)",
        text: Theme.zinc400,
      };
      const hasCard = !!item.stripe_customer_id;
      const smsOptOut = !!item.sms_opt_out;

      return (
        <TouchableOpacity
          onPress={() => router.push(`/(dashboard)/customers/${item.id}`)}
          style={s.customerItem}
          activeOpacity={0.7}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(
                item.first_name?.[0] ||
                item.phone_number?.[0] ||
                "?"
              ).toUpperCase()}
            </Text>
            {hasCard && (
              <View style={s.cardDot}>
                <View style={s.cardDotInner} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.name}>{name}</Text>
              {smsOptOut && (
                <View style={s.optOutBadge}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={10}
                    color={Theme.destructive}
                  />
                </View>
              )}
            </View>
            <Text style={s.phone}>{item.phone_number}</Text>
            {item.email && <Text style={s.meta}>{item.email}</Text>}
          </View>
          {stage ? (
            <View style={[s.badge, { backgroundColor: lColors.bg }]}>
              <Text style={[s.badgeText, { color: lColors.text }]}>
                {stage}
              </Text>
            </View>
          ) : null}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Theme.zinc600}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      );
    },
    [router]
  );

  if (isLoading && !customers.length)
    return <LoadingScreen message="Loading customers..." />;
  if (isError) {
    return (
      <View style={s.container}>
        <View style={{ padding: 24, alignItems: "center" }}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={Theme.destructive}
          />
          <Text
            style={{
              color: Theme.foreground,
              fontSize: 16,
              fontWeight: "600",
              marginTop: 12,
            }}
          >
            Failed to load customers
          </Text>
          <Text
            style={{
              color: Theme.mutedForeground,
              fontSize: 13,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {(error as Error)?.message || "Unknown error"}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              marginTop: 16,
              backgroundColor: Theme.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Search + toolbar */}
      <View style={s.toolbar}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers..."
        />
        <View style={s.toolbarActions}>
          {/* Filter */}
          <TouchableOpacity
            style={[
              s.toolbarBtn,
              activeFilterCount > 0 && s.toolbarBtnActive,
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons
              name="funnel-outline"
              size={16}
              color={activeFilterCount > 0 ? Theme.primary : Theme.mutedForeground}
            />
            {activeFilterCount > 0 && (
              <View style={s.filterCount}>
                <Text style={s.filterCountText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Batch Import */}
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={() => {
              setBatchText("");
              setParsedCustomers([]);
              setBatchStep("input");
              setShowBatchModal(true);
            }}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={Theme.mutedForeground}
            />
          </TouchableOpacity>

          {/* Export */}
          <TouchableOpacity style={s.toolbarBtn} onPress={handleExport}>
            <Ionicons
              name="download-outline"
              size={16}
              color={Theme.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id ?? item.phone_number}
        renderItem={renderCustomer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Theme.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 80,
          gap: 6,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No customers found"
            description={
              search
                ? "Try a different search"
                : "Customers will appear here"
            }
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.8}
        onPress={() => {
          setForm(emptyForm);
          setAddressSuggestions([]);
          setShowAddressSuggestions(false);
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Customer Modal */}
      <Modal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Customer"
      >
        <InputField
          label="First Name"
          value={form.first_name}
          onChangeText={updateField("first_name")}
        />
        <InputField
          label="Last Name"
          value={form.last_name}
          onChangeText={updateField("last_name")}
        />
        <InputField
          label="Phone Number"
          value={form.phone_number}
          onChangeText={updateField("phone_number")}
          keyboardType="phone-pad"
        />
        <InputField
          label="Email"
          value={form.email}
          onChangeText={updateField("email")}
          keyboardType="email-address"
          autoCapitalize="none"
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
            <View style={s.suggestionsContainer}>
              {addressSuggestions.map((prediction, idx) => (
                <TouchableOpacity
                  key={prediction.place_id || idx}
                  style={s.suggestionItem}
                  onPress={() => selectAddress(prediction)}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={Theme.mutedForeground}
                  />
                  <Text style={s.suggestionText} numberOfLines={1}>
                    {prediction.description ||
                      prediction.formatted_address ||
                      ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <InputField
          label="Notes"
          value={form.notes}
          onChangeText={updateField("notes")}
          multiline
        />
        <View style={{ marginTop: 4 }}>
          <ActionButton
            title="Create Customer"
            onPress={handleCreate}
            variant="primary"
            loading={createMutation.isPending}
          />
        </View>
      </Modal>

      {/* Batch Import Modal */}
      <Modal
        visible={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title={batchStep === "input" ? "Batch Import" : "Preview Import"}
      >
        {batchStep === "input" ? (
          <>
            <Text style={s.batchHint}>
              Paste CSV or text data with customer info (name, phone, email,
              address). One customer per line.
            </Text>
            <TextInput
              style={s.batchInput}
              value={batchText}
              onChangeText={setBatchText}
              placeholder="John Doe, 555-123-4567, john@email.com&#10;Jane Smith, 555-987-6543"
              placeholderTextColor={Theme.zinc600}
              multiline
              textAlignVertical="top"
            />
            <ActionButton
              title="Parse Customers"
              onPress={() => parseMutation.mutate(batchText)}
              variant="primary"
              loading={parseMutation.isPending}
              disabled={!batchText.trim()}
            />
          </>
        ) : (
          <>
            <Text style={s.batchHint}>
              Found {parsedCustomers.length} customer(s). Review and confirm.
            </Text>
            <View style={s.previewList}>
              {parsedCustomers.map((c: any, i: number) => (
                <View key={i} style={s.previewItem}>
                  <Text style={s.previewName}>
                    {c.first_name} {c.last_name || ""}
                  </Text>
                  <Text style={s.previewPhone}>
                    {c.phone_number || c.phone || "No phone"}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.batchActions}>
              <ActionButton
                title="Back"
                onPress={() => setBatchStep("input")}
                variant="outline"
              />
              <ActionButton
                title={`Import ${parsedCustomers.length} Customers`}
                onPress={() => batchCreateMutation.mutate(parsedCustomers)}
                variant="primary"
                loading={batchCreateMutation.isPending}
              />
            </View>
          </>
        )}
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Customers"
      >
        <Text style={s.filterSectionTitle}>Lifecycle Stage</Text>
        <View style={s.filterOptions}>
          {LIFECYCLE_OPTIONS.map((opt) => {
            const active = lifecycleFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[s.filterOption, active && s.filterOptionActive]}
                onPress={() => setLifecycleFilter(opt)}
              >
                <Text
                  style={[
                    s.filterOptionText,
                    active && s.filterOptionTextActive,
                  ]}
                >
                  {opt === "all" ? "All" : opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.filterSectionTitle}>Lead Source</Text>
        <View style={s.filterOptions}>
          {LEAD_SOURCE_OPTIONS.map((opt) => {
            const active = leadSourceFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[s.filterOption, active && s.filterOptionActive]}
                onPress={() => setLeadSourceFilter(opt)}
              >
                <Text
                  style={[
                    s.filterOptionText,
                    active && s.filterOptionTextActive,
                  ]}
                >
                  {opt === "all" ? "All" : opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.filterActions}>
          <ActionButton
            title="Clear Filters"
            onPress={() => {
              setLifecycleFilter("all");
              setLeadSourceFilter("all");
            }}
            variant="outline"
          />
          <ActionButton
            title="Apply"
            onPress={() => setShowFilterModal(false)}
            variant="primary"
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  toolbar: {
    gap: 0,
  },
  toolbarActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarBtnActive: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  filterCount: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Theme.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  customerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Theme.glassListItem,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "600", color: Theme.primaryLight },
  cardDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.success,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  optOutBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.destructiveBg,
    alignItems: "center",
    justifyContent: "center",
  },
  phone: { fontSize: 12, color: Theme.mutedForeground, marginTop: 1 },
  meta: { fontSize: 11, color: Theme.zinc600, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  // Address suggestions
  suggestionsContainer: {
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 8,
    marginTop: -8,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: Theme.foreground,
  },
  // Batch import
  batchHint: {
    fontSize: 13,
    color: Theme.mutedForeground,
    lineHeight: 18,
  },
  batchInput: {
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 8,
    padding: 12,
    color: Theme.foreground,
    fontSize: 13,
    minHeight: 140,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  previewList: {
    gap: 4,
    maxHeight: 240,
  },
  previewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Theme.glassListItem,
    borderRadius: 8,
    padding: 10,
  },
  previewName: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
  },
  previewPhone: {
    fontSize: 12,
    color: Theme.mutedForeground,
  },
  batchActions: {
    gap: 8,
  },
  // Filter modal
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 4,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  filterOptionActive: {
    backgroundColor: Theme.primaryMuted,
    borderColor: Theme.primary,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.mutedForeground,
    textTransform: "capitalize",
  },
  filterOptionTextActive: {
    color: Theme.primary,
  },
  filterActions: {
    gap: 8,
    marginTop: 8,
  },
});
