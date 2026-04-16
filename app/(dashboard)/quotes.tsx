import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  fetchQuotes,
  sendQuote,
  createQuote,
  fetchTeams,
  apiFetch,
  estimatePrice,
} from "@/lib/api";
import { Quote, Cleaner } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

const statusTabs = [
  "all",
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
];

const PROPERTY_TYPES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
];

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

interface QuoteForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  line_items: LineItem[];
  notes: string;
  property_type: string;
  sqft: string;
  salesman_override: boolean;
  salesman_price: string;
  send_to_cleaners_first: boolean;
}

interface PreConfirmEntry {
  cleaner_id: string;
  cleaner_name: string;
  status: "pending" | "confirmed" | "declined";
}

const emptyLineItem: LineItem = {
  description: "",
  quantity: "1",
  unit_price: "",
};

const emptyQuoteForm: QuoteForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  line_items: [{ ...emptyLineItem }],
  notes: "",
  property_type: "residential",
  sqft: "",
  salesman_override: false,
  salesman_price: "",
  send_to_cleaners_first: false,
};

export default function QuotesScreen() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>({ ...emptyQuoteForm });
  const [preConfirmModalVisible, setPreConfirmModalVisible] = useState(false);
  const [preConfirmQuote, setPreConfirmQuote] = useState<Quote | null>(null);
  const [selectedCleanerIds, setSelectedCleanerIds] = useState<string[]>([]);
  const [cleanerPay, setCleanerPay] = useState("");
  const [showCleanerPay, setShowCleanerPay] = useState(true);
  const [smsPromptQuoteId, setSmsPromptQuoteId] = useState<string | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimatingPrice, setEstimatingPrice] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () =>
      fetchQuotes(statusFilter === "all" ? {} : { status: statusFilter }),
  });

  const quotes: Quote[] =
    (data as any)?.quotes ?? (data as any)?.data ?? [];

  // Fetch cleaners for the pre-confirm modal
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    enabled: preConfirmModalVisible || quoteForm.send_to_cleaners_first,
  });

  const cleaners: Cleaner[] =
    (teamsQuery.data as any)?.data?.cleaners ??
    (teamsQuery.data as any)?.cleaners ??
    (teamsQuery.data as any)?.data ??
    [];

  const sendMutation = useMutation({
    mutationFn: (quoteId: string) => sendQuote(quoteId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      Alert.alert("Success", "Quote sent");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createQuote(payload),
    onSuccess: (result: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setCreateModalVisible(false);
      setQuoteForm({ ...emptyQuoteForm });
      setEstimatedPrice(null);
      const newQuoteId =
        result?.data?.id ?? result?.id ?? result?.quote?.id;
      if (newQuoteId) {
        if (quoteForm.send_to_cleaners_first) {
          // Go directly to pre-confirm flow
          const fakeQuote = {
            id: newQuoteId,
            customer_name: quoteForm.customer_name,
            total: calcTotal(),
          } as Quote;
          openPreConfirmModal(fakeQuote);
        } else {
          setSmsPromptQuoteId(newQuoteId);
        }
      } else {
        Alert.alert("Success", "Quote created");
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const preConfirmMutation = useMutation({
    mutationFn: (payload: {
      quote_id: string;
      cleaner_ids: string[];
      cleaner_pay: number;
      show_pay?: boolean;
    }) =>
      apiFetch("/api/actions/quotes/preconfirm", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setPreConfirmModalVisible(false);
      setPreConfirmQuote(null);
      setSelectedCleanerIds([]);
      setCleanerPay("");
      Alert.alert("Success", "Pre-confirmation sent to cleaners");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const smsAfterCreateMutation = useMutation({
    mutationFn: (quoteId: string) =>
      apiFetch("/api/actions/quotes/send", {
        method: "POST",
        body: JSON.stringify({ quote_id: quoteId }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSmsPromptQuoteId(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      Alert.alert("Success", "Quote SMS sent to customer");
    },
    onError: (err: Error) => {
      setSmsPromptQuoteId(null);
      Alert.alert("Error", err.message);
    },
  });

  // --- Helpers ---

  const calcTotal = (): number => {
    if (quoteForm.salesman_override && quoteForm.salesman_price) {
      return parseFloat(quoteForm.salesman_price) || 0;
    }
    return quoteForm.line_items.reduce((sum, li) => {
      const qty = parseFloat(li.quantity) || 0;
      const price = parseFloat(li.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string
  ) => {
    setQuoteForm((f) => {
      const items = [...f.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, line_items: items };
    });
  };

  const addLineItem = () => {
    setQuoteForm((f) => ({
      ...f,
      line_items: [...f.line_items, { ...emptyLineItem }],
    }));
  };

  const removeLineItem = (index: number) => {
    setQuoteForm((f) => {
      if (f.line_items.length <= 1) return f;
      const items = f.line_items.filter((_, i) => i !== index);
      return { ...f, line_items: items };
    });
  };

  const handleEstimatePrice = async () => {
    const sqft = parseInt(quoteForm.sqft, 10);
    if (!sqft) {
      Alert.alert("Validation", "Enter square footage to estimate.");
      return;
    }
    setEstimatingPrice(true);
    try {
      const res = await estimatePrice({
        property_type: quoteForm.property_type,
        sqft,
      });
      const est =
        (res as any)?.estimated_price ??
        (res as any)?.price ??
        (res as any)?.total ??
        null;
      if (typeof est === "number") {
        setEstimatedPrice(est);
      } else {
        Alert.alert("Info", "Could not get an estimate for these parameters.");
      }
    } catch {
      Alert.alert("Error", "Failed to estimate price.");
    } finally {
      setEstimatingPrice(false);
    }
  };

  const handleCreateQuote = () => {
    if (!quoteForm.customer_name.trim()) {
      Alert.alert("Validation", "Customer name is required");
      return;
    }
    if (
      !quoteForm.salesman_override &&
      quoteForm.line_items.every((li) => !li.description.trim())
    ) {
      Alert.alert("Validation", "At least one line item is required");
      return;
    }

    const total = calcTotal();
    const payload: Record<string, any> = {
      customer_name: quoteForm.customer_name,
      customer_phone: quoteForm.customer_phone,
      customer_email: quoteForm.customer_email,
      customer_address: quoteForm.customer_address,
      notes: quoteForm.notes,
      property_type: quoteForm.property_type,
      sqft: quoteForm.sqft ? parseInt(quoteForm.sqft, 10) : undefined,
      total,
    };

    if (quoteForm.salesman_override) {
      payload.salesman_override = true;
      payload.salesman_price = total;
      payload.line_items = [
        {
          description: "Salesman-quoted price",
          quantity: 1,
          unit_price: total,
        },
      ];
    } else {
      payload.line_items = quoteForm.line_items
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unit_price: parseFloat(li.unit_price) || 0,
        }));
    }

    createMutation.mutate(payload);
  };

  const toggleCleanerSelection = (id: string) => {
    setSelectedCleanerIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handlePreConfirmSubmit = () => {
    if (!preConfirmQuote) return;
    if (selectedCleanerIds.length === 0) {
      Alert.alert("Validation", "Select at least one cleaner");
      return;
    }
    const pay = parseFloat(cleanerPay);
    if (!pay || pay <= 0) {
      Alert.alert("Validation", "Enter a valid cleaner pay amount");
      return;
    }
    preConfirmMutation.mutate({
      quote_id: preConfirmQuote.id,
      cleaner_ids: selectedCleanerIds,
      cleaner_pay: pay,
      show_pay: showCleanerPay,
    });
  };

  const openPreConfirmModal = (quote: Quote) => {
    setPreConfirmQuote(quote);
    setSelectedCleanerIds([]);
    setCleanerPay("");
    setShowCleanerPay(true);
    setPreConfirmModalVisible(true);
  };

  const getQuoteUrl = (quote: Quote): string => {
    return `https://spotless-scrubbers-api.vercel.app/quotes/${quote.id}`;
  };

  const handleCopyQuoteUrl = async (quote: Quote) => {
    const url = getQuoteUrl(quote);
    try {
      await Clipboard.setStringAsync(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Quote link copied to clipboard");
    } catch {
      Alert.alert("Error", "Failed to copy link");
    }
  };

  const handleOpenQuoteUrl = (quote: Quote) => {
    const url = getQuoteUrl(quote);
    Linking.openURL(url);
  };

  const getPreConfirmStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return Theme.success;
      case "declined":
        return Theme.destructive;
      default:
        return Theme.warning ?? "#f59e0b";
    }
  };

  const getPreConfirmStatusIcon = (
    status: string
  ): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (status) {
      case "confirmed":
        return "checkmark-circle";
      case "declined":
        return "close-circle";
      default:
        return "time";
    }
  };

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

  if (isLoading) return <LoadingScreen message="Loading quotes..." />;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusTabs}
          keyExtractor={(item) => item}
          style={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setStatusFilter(item)}
              style={[
                styles.filterChip,
                statusFilter === item
                  ? styles.filterChipActive
                  : styles.filterChipInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === item ? styles.filterChipTextActive : {},
                ]}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Theme.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 80,
        }}
        renderItem={({ item }) => {
          const preConfirms: PreConfirmEntry[] =
            (item as any).pre_confirms ?? (item as any).preconfirms ?? [];
          return (
            <GlassCard style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {item.customer_name || `Quote #${item.id.slice(-6)}`}
                  </Text>
                  <Text style={styles.subText}>
                    {item.customer_phone || ""}
                  </Text>
                  {(item as any).property_type && (
                    <View style={styles.propertyTypeBadge}>
                      <Ionicons
                        name={
                          (item as any).property_type === "commercial"
                            ? "business-outline"
                            : "home-outline"
                        }
                        size={12}
                        color={Theme.mutedForeground}
                      />
                      <Text style={styles.propertyTypeText}>
                        {(item as any).property_type}
                      </Text>
                    </View>
                  )}
                </View>
                <Badge
                  label={item.status}
                  variant={
                    item.status === "accepted"
                      ? "success"
                      : item.status === "declined" || item.status === "expired"
                      ? "error"
                      : item.status === "sent" || item.status === "viewed"
                      ? "info"
                      : "default"
                  }
                />
              </View>
              <Text style={styles.totalText}>${item.total}</Text>
              {item.line_items && item.line_items.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {item.line_items.map((li, i) => (
                    <Text key={i} style={styles.lineItem}>
                      {"\u2022"} {li.description} ({li.quantity}x $
                      {li.unit_price})
                    </Text>
                  ))}
                </View>
              )}
              <Text style={styles.dateText}>
                Created {new Date(item.created_at).toLocaleDateString()}
                {item.valid_until &&
                  ` \u2022 Valid until ${new Date(
                    item.valid_until
                  ).toLocaleDateString()}`}
              </Text>

              {/* Pre-confirm status tracking */}
              {preConfirms.length > 0 && (
                <View style={styles.preConfirmSection}>
                  <Text style={styles.preConfirmHeader}>
                    Cleaner Pre-Confirmations
                  </Text>
                  {preConfirms.map((pc, i) => (
                    <View key={i} style={styles.preConfirmRow}>
                      <Ionicons
                        name={getPreConfirmStatusIcon(pc.status)}
                        size={16}
                        color={getPreConfirmStatusColor(pc.status)}
                      />
                      <Text style={styles.preConfirmName}>
                        {pc.cleaner_name || `Cleaner ${pc.cleaner_id}`}
                      </Text>
                      <Text
                        style={[
                          styles.preConfirmStatus,
                          { color: getPreConfirmStatusColor(pc.status) },
                        ]}
                      >
                        {pc.status.charAt(0).toUpperCase() + pc.status.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action buttons row */}
              <View style={styles.actionRow}>
                {(item.status === "draft" || item.status === "sent") && (
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Button
                      title={item.status === "draft" ? "Send Quote" : "Resend"}
                      variant="outline"
                      size="sm"
                      onPress={() => sendMutation.mutate(item.id)}
                      loading={sendMutation.isPending}
                    />
                  </View>
                )}
                <View
                  style={{
                    flex: 1,
                    marginLeft:
                      item.status === "draft" || item.status === "sent"
                        ? 6
                        : 0,
                  }}
                >
                  <Button
                    title="Pre-confirm"
                    variant="outline"
                    size="sm"
                    onPress={() => openPreConfirmModal(item)}
                  />
                </View>
              </View>

              {/* Link actions row */}
              <View style={styles.linkActionsRow}>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => handleCopyQuoteUrl(item)}
                >
                  <Ionicons name="copy-outline" size={14} color={Theme.primary} />
                  <Text style={styles.linkBtnText}>Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => handleOpenQuoteUrl(item)}
                >
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={Theme.primary}
                  />
                  <Text style={styles.linkBtnText}>Open</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No quotes"
            description="Quotes will appear here"
          />
        }
      />

      {/* FAB - Create Quote */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setQuoteForm({ ...emptyQuoteForm });
          setEstimatedPrice(null);
          setCreateModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Quote Modal */}
      <Modal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setQuoteForm({ ...emptyQuoteForm });
          setEstimatedPrice(null);
        }}
        title="Create Quote"
      >
        <ScrollView
          style={{ maxHeight: 500 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <InputField
            label="Customer Name"
            value={quoteForm.customer_name}
            onChangeText={(v: string) =>
              setQuoteForm((f) => ({ ...f, customer_name: v }))
            }
          />
          <InputField
            label="Phone"
            value={quoteForm.customer_phone}
            onChangeText={(v: string) =>
              setQuoteForm((f) => ({ ...f, customer_phone: v }))
            }
            keyboardType="phone-pad"
          />
          <InputField
            label="Email"
            value={quoteForm.customer_email}
            onChangeText={(v: string) =>
              setQuoteForm((f) => ({ ...f, customer_email: v }))
            }
            keyboardType="email-address"
          />
          <InputField
            label="Address"
            value={quoteForm.customer_address}
            onChangeText={(v: string) =>
              setQuoteForm((f) => ({ ...f, customer_address: v }))
            }
          />

          {/* Property type & sqft */}
          <PickerRow
            label="Property Type"
            options={PROPERTY_TYPES}
            value={quoteForm.property_type}
            onSelect={(v) =>
              setQuoteForm((f) => ({ ...f, property_type: v }))
            }
          />

          <View style={styles.sqftRow}>
            <View style={{ flex: 1 }}>
              <InputField
                label="Square Footage"
                value={quoteForm.sqft}
                onChangeText={(v: string) =>
                  setQuoteForm((f) => ({ ...f, sqft: v }))
                }
                keyboardType="numeric"
                placeholder="e.g. 2000"
              />
            </View>
            <TouchableOpacity
              style={styles.estimateBtn}
              onPress={handleEstimatePrice}
              disabled={estimatingPrice}
            >
              {estimatingPrice ? (
                <ActivityIndicator size="small" color={Theme.primary} />
              ) : (
                <>
                  <Ionicons
                    name="calculator-outline"
                    size={16}
                    color={Theme.primary}
                  />
                  <Text style={styles.estimateBtnText}>Estimate</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {estimatedPrice !== null && (
            <TouchableOpacity
              style={styles.estimateResult}
              onPress={() => {
                if (!quoteForm.salesman_override) {
                  // Apply to first line item or salesman price
                  if (quoteForm.line_items.length > 0) {
                    updateLineItem(
                      0,
                      "unit_price",
                      estimatedPrice.toFixed(2)
                    );
                  }
                } else {
                  setQuoteForm((f) => ({
                    ...f,
                    salesman_price: estimatedPrice.toFixed(2),
                  }));
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="pricetag" size={14} color={Theme.success} />
              <Text style={styles.estimateResultText}>
                Estimated: ${estimatedPrice.toFixed(2)}
              </Text>
              <Text style={styles.estimateResultUse}>Tap to use</Text>
            </TouchableOpacity>
          )}

          {/* Salesman override */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Salesman-Quoted Price</Text>
              <Text style={styles.toggleDesc}>
                Override line items with a custom price
              </Text>
            </View>
            <Switch
              value={quoteForm.salesman_override}
              onValueChange={(v) =>
                setQuoteForm((f) => ({ ...f, salesman_override: v }))
              }
              trackColor={{ false: Theme.zinc700, true: Theme.primary + "66" }}
              thumbColor={
                quoteForm.salesman_override ? Theme.primary : Theme.zinc400
              }
            />
          </View>

          {quoteForm.salesman_override ? (
            <InputField
              label="Custom Base Price ($)"
              value={quoteForm.salesman_price}
              onChangeText={(v: string) =>
                setQuoteForm((f) => ({ ...f, salesman_price: v }))
              }
              keyboardType="decimal-pad"
              placeholder="e.g. 350.00"
            />
          ) : (
            <>
              <View style={styles.lineItemsHeader}>
                <Text style={styles.sectionLabel}>Line Items</Text>
                <TouchableOpacity
                  onPress={addLineItem}
                  style={styles.addLineBtn}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={Theme.primary}
                  />
                  <Text style={styles.addLineBtnText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {quoteForm.line_items.map((li, index) => (
                <View key={index} style={styles.lineItemCard}>
                  <View style={styles.lineItemHeaderRow}>
                    <Text style={styles.lineItemIndex}>Item {index + 1}</Text>
                    {quoteForm.line_items.length > 1 && (
                      <TouchableOpacity onPress={() => removeLineItem(index)}>
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={Theme.destructive}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <InputField
                    label="Description"
                    value={li.description}
                    onChangeText={(v: string) =>
                      updateLineItem(index, "description", v)
                    }
                  />
                  <View style={styles.lineItemRow}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label="Qty"
                        value={li.quantity}
                        onChangeText={(v: string) =>
                          updateLineItem(index, "quantity", v)
                        }
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label="Unit Price"
                        value={li.unit_price}
                        onChangeText={(v: string) =>
                          updateLineItem(index, "unit_price", v)
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${calcTotal().toFixed(2)}</Text>
          </View>

          <InputField
            label="Notes"
            value={quoteForm.notes}
            onChangeText={(v: string) =>
              setQuoteForm((f) => ({ ...f, notes: v }))
            }
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: "top" }}
          />

          {/* Workflow toggle */}
          <View style={styles.workflowSection}>
            <Text style={styles.workflowTitle}>Send Workflow</Text>
            <View style={styles.workflowOptions}>
              <TouchableOpacity
                style={[
                  styles.workflowOption,
                  !quoteForm.send_to_cleaners_first &&
                    styles.workflowOptionActive,
                ]}
                onPress={() =>
                  setQuoteForm((f) => ({
                    ...f,
                    send_to_cleaners_first: false,
                  }))
                }
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={
                    !quoteForm.send_to_cleaners_first
                      ? Theme.primary
                      : Theme.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.workflowOptionText,
                    !quoteForm.send_to_cleaners_first &&
                      styles.workflowOptionTextActive,
                  ]}
                >
                  Send via SMS
                </Text>
                <Text style={styles.workflowOptionDesc}>
                  Send quote link directly to customer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.workflowOption,
                  quoteForm.send_to_cleaners_first &&
                    styles.workflowOptionActive,
                ]}
                onPress={() =>
                  setQuoteForm((f) => ({
                    ...f,
                    send_to_cleaners_first: true,
                  }))
                }
              >
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={
                    quoteForm.send_to_cleaners_first
                      ? Theme.primary
                      : Theme.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.workflowOptionText,
                    quoteForm.send_to_cleaners_first &&
                      styles.workflowOptionTextActive,
                  ]}
                >
                  Send to Cleaners First
                </Text>
                <Text style={styles.workflowOptionDesc}>
                  Get cleaner pre-confirmation before sending to customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <ActionButton
              title="Create Quote"
              onPress={handleCreateQuote}
              variant="primary"
              loading={createMutation.isPending}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* SMS Prompt after Quote Creation */}
      <Modal
        visible={!!smsPromptQuoteId}
        onClose={() => setSmsPromptQuoteId(null)}
        title="Quote Created"
      >
        <View style={styles.smsPromptContent}>
          <Ionicons
            name="checkmark-circle"
            size={48}
            color={Theme.success}
            style={{ alignSelf: "center" }}
          />
          <Text style={styles.smsPromptTitle}>
            Quote created successfully
          </Text>
          <Text style={styles.smsPromptDesc}>
            Would you like to SMS the quote link to the customer?
          </Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton
              title="Send SMS to Customer"
              onPress={() => {
                if (smsPromptQuoteId) {
                  smsAfterCreateMutation.mutate(smsPromptQuoteId);
                }
              }}
              variant="primary"
              loading={smsAfterCreateMutation.isPending}
            />
            {smsPromptQuoteId && (
              <ActionButton
                title="Copy Quote Link"
                onPress={async () => {
                  const url = `https://spotless-scrubbers-api.vercel.app/quotes/${smsPromptQuoteId}`;
                  try {
                    await Clipboard.setStringAsync(url);
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                    Alert.alert("Copied", "Quote link copied to clipboard");
                  } catch {
                    Alert.alert("Error", "Failed to copy link");
                  }
                }}
                variant="outline"
              />
            )}
            <ActionButton
              title="Skip"
              onPress={() => setSmsPromptQuoteId(null)}
              variant="outline"
              disabled={smsAfterCreateMutation.isPending}
            />
          </View>
        </View>
      </Modal>

      {/* Pre-confirm with Cleaners Modal */}
      <Modal
        visible={preConfirmModalVisible}
        onClose={() => {
          setPreConfirmModalVisible(false);
          setPreConfirmQuote(null);
          setSelectedCleanerIds([]);
          setCleanerPay("");
        }}
        title="Pre-confirm with Cleaners"
      >
        {preConfirmQuote && (
          <View>
            <GlassCard style={styles.preConfirmQuoteSummary}>
              <Text style={styles.preConfirmQuoteLabel}>
                {preConfirmQuote.customer_name ||
                  `Quote #${preConfirmQuote.id.slice(-6)}`}
              </Text>
              <Text style={styles.preConfirmQuoteTotal}>
                ${preConfirmQuote.total}
              </Text>
            </GlassCard>

            <Text
              style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}
            >
              Select Cleaners
            </Text>

            {teamsQuery.isLoading ? (
              <View style={styles.loadingCleaners}>
                <ActivityIndicator size="small" color={Theme.primary} />
                <Text style={styles.loadingCleanersText}>
                  Loading cleaners...
                </Text>
              </View>
            ) : cleaners.length === 0 ? (
              <Text style={styles.noCleanersText}>
                No cleaners available
              </Text>
            ) : (
              <View style={styles.cleanersList}>
                {cleaners.map((cleaner) => {
                  const id = String(cleaner.id);
                  const isSelected = selectedCleanerIds.includes(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[
                        styles.cleanerRow,
                        isSelected && styles.cleanerRowSelected,
                      ]}
                      onPress={() => toggleCleanerSelection(id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxChecked,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cleanerName}>{cleaner.name}</Text>
                        {cleaner.phone && (
                          <Text style={styles.cleanerPhone}>
                            {cleaner.phone}
                          </Text>
                        )}
                      </View>
                      {cleaner.is_team_lead && (
                        <Badge label="Lead" variant="info" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ marginTop: 16 }}>
              <InputField
                label="Cleaner Pay ($)"
                value={cleanerPay}
                onChangeText={setCleanerPay}
                keyboardType="decimal-pad"
                placeholder="e.g. 120.00"
              />
            </View>

            {/* Pay visibility toggle */}
            <View style={styles.payVisibilityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payVisibilityLabel}>
                  Show Pay to Cleaners
                </Text>
                <Text style={styles.payVisibilityDesc}>
                  Cleaners will see the pay amount in their notification
                </Text>
              </View>
              <Switch
                value={showCleanerPay}
                onValueChange={setShowCleanerPay}
                trackColor={{
                  false: Theme.zinc700,
                  true: Theme.primary + "66",
                }}
                thumbColor={showCleanerPay ? Theme.primary : Theme.zinc400}
              />
            </View>

            {selectedCleanerIds.length > 0 && cleanerPay && (
              <View style={styles.preConfirmSummaryRow}>
                <Text style={styles.preConfirmSummaryText}>
                  {selectedCleanerIds.length} cleaner
                  {selectedCleanerIds.length > 1 ? "s" : ""} selected
                  {" \u2022 "}${parseFloat(cleanerPay || "0").toFixed(2)} each
                  {!showCleanerPay ? " (pay hidden)" : ""}
                </Text>
              </View>
            )}

            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <ActionButton
                title={`Send Pre-confirmation${
                  selectedCleanerIds.length > 0
                    ? ` (${selectedCleanerIds.length})`
                    : ""
                }`}
                onPress={handlePreConfirmSubmit}
                variant="primary"
                loading={preConfirmMutation.isPending}
                disabled={selectedCleanerIds.length === 0 || !cleanerPay}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterList: {
    flex: 1,
    maxHeight: 48,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterChip: {
    marginHorizontal: 4,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: Theme.primary,
  },
  filterChipInactive: {
    backgroundColor: Theme.muted,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  card: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  propertyTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  propertyTypeText: {
    fontSize: 11,
    color: Theme.mutedForeground,
    textTransform: "capitalize",
  },
  totalText: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: Theme.foreground,
  },
  lineItem: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  linkActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: Theme.primaryMuted,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.primary,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  // Pickers
  pickerLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
    marginBottom: 6,
    marginTop: 8,
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
  // Sqft + estimate
  sqftRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  estimateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.primary + "33",
    marginBottom: 8,
  },
  estimateBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.primary,
  },
  estimateResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Theme.successBg,
    borderRadius: 6,
    marginBottom: 8,
  },
  estimateResultText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.success,
  },
  estimateResultUse: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginLeft: "auto",
  },
  // Salesman toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.border,
    marginTop: 12,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  toggleDesc: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  // Workflow section
  workflowSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Theme.card,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  workflowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 8,
  },
  workflowOptions: {
    gap: 8,
  },
  workflowOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
  },
  workflowOptionActive: {
    borderColor: Theme.primary,
    backgroundColor: Theme.primaryMuted,
  },
  workflowOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.mutedForeground,
    marginTop: 4,
  },
  workflowOptionTextActive: {
    color: Theme.primary,
  },
  workflowOptionDesc: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.foreground,
  },
  lineItemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  addLineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addLineBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.primary,
  },
  lineItemCard: {
    backgroundColor: Theme.muted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  lineItemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  lineItemIndex: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lineItemRow: {
    flexDirection: "row",
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.foreground,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Theme.success,
  },
  // Pre-confirm status on quote card
  preConfirmSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  preConfirmHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  preConfirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  preConfirmName: {
    flex: 1,
    fontSize: 13,
    color: Theme.foreground,
  },
  preConfirmStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Pre-confirm modal styles
  preConfirmQuoteSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  preConfirmQuoteLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
  },
  preConfirmQuoteTotal: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.success,
  },
  loadingCleaners: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    justifyContent: "center",
  },
  loadingCleanersText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  noCleanersText: {
    fontSize: 13,
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingVertical: 16,
  },
  cleanersList: {
    gap: 6,
  },
  cleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cleanerRowSelected: {
    borderColor: Theme.primary,
    backgroundColor: "rgba(0,145,255,0.08)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  cleanerName: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.foreground,
  },
  cleanerPhone: {
    fontSize: 12,
    color: Theme.mutedForeground,
    marginTop: 1,
  },
  // Pay visibility toggle
  payVisibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    marginTop: 10,
  },
  payVisibilityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.foreground,
  },
  payVisibilityDesc: {
    fontSize: 11,
    color: Theme.mutedForeground,
    marginTop: 1,
  },
  preConfirmSummaryRow: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,145,255,0.06)",
    borderRadius: 8,
  },
  preConfirmSummaryText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.primary,
    textAlign: "center",
  },
  // SMS prompt modal styles
  smsPromptContent: {
    paddingVertical: 8,
  },
  smsPromptTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.foreground,
    textAlign: "center",
    marginTop: 12,
  },
  smsPromptDesc: {
    fontSize: 14,
    color: Theme.mutedForeground,
    textAlign: "center",
    marginTop: 6,
  },
});
