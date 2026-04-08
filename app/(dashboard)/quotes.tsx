import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, StyleSheet, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchQuotes, sendQuote, createQuote } from "@/lib/api";
import { Quote } from "@/types";
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
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () => fetchQuotes(statusFilter === "all" ? {} : { status: statusFilter }),
  });

  const quotes: Quote[] = (data as any)?.quotes ?? (data as any)?.data ?? [];

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
    mutationFn: (data: any) => createQuote(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setCreateModalVisible(false);
      setQuoteForm(emptyQuoteForm);
      Alert.alert("Success", "Quote created");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
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
        renderItem={({ item }) => (
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
            {(item.status === "draft" || item.status === "sent") && (
              <View style={{ marginTop: 8 }}>
                <Button
                  title={item.status === "draft" ? "Send Quote" : "Resend"}
                  variant="outline"
                  size="sm"
                  onPress={() => sendMutation.mutate(item.id)}
                  loading={sendMutation.isPending}
                />
              </View>
            )}
          </GlassCard>
        )}
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
});
