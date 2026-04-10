import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchQuotes, sendQuote, createQuote, fetchTeams, apiFetch } from "@/lib/api";
import { Quote, Cleaner } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

const statusTabs = ["all", "draft", "sent", "viewed", "accepted", "declined", "expired"];

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
}

interface PreConfirmEntry {
  cleaner_id: string;
  cleaner_name: string;
  status: "pending" | "confirmed" | "declined";
}

const emptyLineItem: LineItem = { description: "", quantity: "1", unit_price: "" };

const emptyQuoteForm: QuoteForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  line_items: [{ ...emptyLineItem }],
  notes: "",
};

export default function QuotesScreen() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuoteForm);
  const [preConfirmModalVisible, setPreConfirmModalVisible] = useState(false);
  const [preConfirmQuote, setPreConfirmQuote] = useState<Quote | null>(null);
  const [selectedCleanerIds, setSelectedCleanerIds] = useState<string[]>([]);
  const [cleanerPay, setCleanerPay] = useState("");
  const [smsPromptQuoteId, setSmsPromptQuoteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () => fetchQuotes(statusFilter === "all" ? {} : { status: statusFilter }),
  });

  const quotes: Quote[] = (data as any)?.quotes ?? (data as any)?.data ?? [];

  // Fetch cleaners for the pre-confirm modal
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    enabled: preConfirmModalVisible,
  });

  const cleaners: Cleaner[] = (teamsQuery.data as any)?.data?.cleaners
    ?? (teamsQuery.data as any)?.cleaners
    ?? (teamsQuery.data as any)?.data
    ?? [];

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
      setQuoteForm(emptyQuoteForm);
      const newQuoteId = result?.data?.id ?? result?.id ?? result?.quote?.id;
      if (newQuoteId) {
        setSmsPromptQuoteId(newQuoteId);
      } else {
        Alert.alert("Success", "Quote created");
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const preConfirmMutation = useMutation({
    mutationFn: (payload: { quote_id: string; cleaner_ids: string[]; cleaner_pay: number }) =>
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

  const calcTotal = (): number => {
    return quoteForm.line_items.reduce((sum, li) => {
      const qty = parseFloat(li.quantity) || 0;
      const price = parseFloat(li.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setQuoteForm((f) => {
      const items = [...f.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, line_items: items };
    });
  };

  const addLineItem = () => {
    setQuoteForm((f) => ({ ...f, line_items: [...f.line_items, { ...emptyLineItem }] }));
  };

  const removeLineItem = (index: number) => {
    setQuoteForm((f) => {
      if (f.line_items.length <= 1) return f;
      const items = f.line_items.filter((_, i) => i !== index);
      return { ...f, line_items: items };
    });
  };

  const handleCreateQuote = () => {
    if (!quoteForm.customer_name.trim()) {
      Alert.alert("Validation", "Customer name is required");
      return;
    }
    if (quoteForm.line_items.every((li) => !li.description.trim())) {
      Alert.alert("Validation", "At least one line item is required");
      return;
    }
    const payload = {
      customer_name: quoteForm.customer_name,
      customer_phone: quoteForm.customer_phone,
      customer_email: quoteForm.customer_email,
      customer_address: quoteForm.customer_address,
      notes: quoteForm.notes,
      line_items: quoteForm.line_items
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unit_price: parseFloat(li.unit_price) || 0,
        })),
      total: calcTotal(),
    };
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
    });
  };

  const openPreConfirmModal = (quote: Quote) => {
    setPreConfirmQuote(quote);
    setSelectedCleanerIds([]);
    setCleanerPay("");
    setPreConfirmModalVisible(true);
  };

  const getPreConfirmStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return Theme.success;
      case "declined": return Theme.destructive;
      default: return Theme.warning ?? "#f59e0b";
    }
  };

  const getPreConfirmStatusIcon = (status: string): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (status) {
      case "confirmed": return "checkmark-circle";
      case "declined": return "close-circle";
      default: return "time";
    }
  };

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
                statusFilter === item ? styles.filterChipActive : styles.filterChipInactive,
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const preConfirms: PreConfirmEntry[] = (item as any).pre_confirms ?? (item as any).preconfirms ?? [];
          return (
            <GlassCard style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {item.customer_name || `Quote #${item.id.slice(-6)}`}
                  </Text>
                  <Text style={styles.subText}>{item.customer_phone || ""}</Text>
                </View>
                <Badge
                  label={item.status}
                  variant={
                    item.status === "accepted" ? "success" :
                    item.status === "declined" || item.status === "expired" ? "error" :
                    item.status === "sent" || item.status === "viewed" ? "info" : "default"
                  }
                />
              </View>
              <Text style={styles.totalText}>${item.total}</Text>
              {item.line_items && item.line_items.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {item.line_items.map((li, i) => (
                    <Text key={i} style={styles.lineItem}>
                      {"\u2022"} {li.description} ({li.quantity}x ${li.unit_price})
                    </Text>
                  ))}
                </View>
              )}
              <Text style={styles.dateText}>
                Created {new Date(item.created_at).toLocaleDateString()}
                {item.valid_until && ` \u2022 Valid until ${new Date(item.valid_until).toLocaleDateString()}`}
              </Text>

              {/* Pre-confirm status tracking */}
              {preConfirms.length > 0 && (
                <View style={styles.preConfirmSection}>
                  <Text style={styles.preConfirmHeader}>Cleaner Pre-Confirmations</Text>
                  {preConfirms.map((pc, i) => (
                    <View key={i} style={styles.preConfirmRow}>
                      <Ionicons
                        name={getPreConfirmStatusIcon(pc.status)}
                        size={16}
                        color={getPreConfirmStatusColor(pc.status)}
                      />
                      <Text style={styles.preConfirmName}>{pc.cleaner_name || `Cleaner ${pc.cleaner_id}`}</Text>
                      <Text style={[styles.preConfirmStatus, { color: getPreConfirmStatusColor(pc.status) }]}>
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
                <View style={{ flex: 1, marginLeft: item.status === "draft" || item.status === "sent" ? 6 : 0 }}>
                  <Button
                    title="Pre-confirm"
                    variant="outline"
                    size="sm"
                    onPress={() => openPreConfirmModal(item)}
                  />
                </View>
              </View>
            </GlassCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No quotes" description="Quotes will appear here" />
        }
      />

      {/* FAB - Create Quote */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setQuoteForm(emptyQuoteForm);
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
          setQuoteForm(emptyQuoteForm);
        }}
        title="Create Quote"
      >
        <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <InputField
            label="Customer Name"
            value={quoteForm.customer_name}
            onChangeText={(v: string) => setQuoteForm((f) => ({ ...f, customer_name: v }))}
          />
          <InputField
            label="Phone"
            value={quoteForm.customer_phone}
            onChangeText={(v: string) => setQuoteForm((f) => ({ ...f, customer_phone: v }))}
          />
          <InputField
            label="Email"
            value={quoteForm.customer_email}
            onChangeText={(v: string) => setQuoteForm((f) => ({ ...f, customer_email: v }))}
          />
          <InputField
            label="Address"
            value={quoteForm.customer_address}
            onChangeText={(v: string) => setQuoteForm((f) => ({ ...f, customer_address: v }))}
          />

          <View style={styles.lineItemsHeader}>
            <Text style={styles.sectionLabel}>Line Items</Text>
            <TouchableOpacity onPress={addLineItem} style={styles.addLineBtn}>
              <Ionicons name="add-circle-outline" size={18} color={Theme.primary} />
              <Text style={styles.addLineBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {quoteForm.line_items.map((li, index) => (
            <View key={index} style={styles.lineItemCard}>
              <View style={styles.lineItemHeaderRow}>
                <Text style={styles.lineItemIndex}>Item {index + 1}</Text>
                {quoteForm.line_items.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(index)}>
                    <Ionicons name="close-circle" size={20} color={Theme.destructive} />
                  </TouchableOpacity>
                )}
              </View>
              <InputField
                label="Description"
                value={li.description}
                onChangeText={(v: string) => updateLineItem(index, "description", v)}
              />
              <View style={styles.lineItemRow}>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Qty"
                    value={li.quantity}
                    onChangeText={(v: string) => updateLineItem(index, "quantity", v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Unit Price"
                    value={li.unit_price}
                    onChangeText={(v: string) => updateLineItem(index, "unit_price", v)}
                  />
                </View>
              </View>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${calcTotal().toFixed(2)}</Text>
          </View>

          <InputField
            label="Notes"
            value={quoteForm.notes}
            onChangeText={(v: string) => setQuoteForm((f) => ({ ...f, notes: v }))}
          />

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
          <Ionicons name="checkmark-circle" size={48} color={Theme.success} style={{ alignSelf: "center" }} />
          <Text style={styles.smsPromptTitle}>Quote created successfully</Text>
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
                {preConfirmQuote.customer_name || `Quote #${preConfirmQuote.id.slice(-6)}`}
              </Text>
              <Text style={styles.preConfirmQuoteTotal}>${preConfirmQuote.total}</Text>
            </GlassCard>

            <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>
              Select Cleaners
            </Text>

            {teamsQuery.isLoading ? (
              <View style={styles.loadingCleaners}>
                <ActivityIndicator size="small" color={Theme.primary} />
                <Text style={styles.loadingCleanersText}>Loading cleaners...</Text>
              </View>
            ) : cleaners.length === 0 ? (
              <Text style={styles.noCleanersText}>No cleaners available</Text>
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
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cleanerName}>{cleaner.name}</Text>
                        {cleaner.phone && (
                          <Text style={styles.cleanerPhone}>{cleaner.phone}</Text>
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

            {selectedCleanerIds.length > 0 && cleanerPay && (
              <View style={styles.preConfirmSummaryRow}>
                <Text style={styles.preConfirmSummaryText}>
                  {selectedCleanerIds.length} cleaner{selectedCleanerIds.length > 1 ? "s" : ""} selected
                  {" \u2022 "}${parseFloat(cleanerPay || "0").toFixed(2)} each
                </Text>
              </View>
            )}

            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <ActionButton
                title={`Send Pre-confirmation${selectedCleanerIds.length > 0 ? ` (${selectedCleanerIds.length})` : ""}`}
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
