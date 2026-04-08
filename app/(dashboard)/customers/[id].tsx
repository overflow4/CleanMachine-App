import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchCustomers, fetchInboxThread, sendSms, fetchJobs, fetchQuotes, fetchMemberships, updateCustomer, generatePaymentLink, sendInvoice, chargeCard } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { Theme } from "@/constants/colors";
import { Customer, Message, Job, Quote } from "@/types";

type Tab = "messages" | "jobs" | "quotes" | "payments" | "info";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [newMessage, setNewMessage] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [chargeAmount, setChargeAmount] = useState("");
  const queryClient = useQueryClient();

  // Get customer from cached list — no /api/customers/:id endpoint exists
  const customersQuery = useQuery({ queryKey: ["customers", ""], queryFn: () => fetchCustomers() });
  const allCustomers: Customer[] = useMemo(() => {
    const raw = customersQuery.data as any;
    return raw?.data?.customers ?? raw?.data ?? raw?.customers ?? [];
  }, [customersQuery.data]);
  const customer = useMemo(() => allCustomers.find((c) => String(c.id) === String(id)), [allCustomers, id]);

  // Queries
  const threadQuery = useQuery({ queryKey: ["inbox-thread", id], queryFn: () => fetchInboxThread(Number(id)), enabled: !!id && !!customer && activeTab === "messages", retry: 1 });
  const jobsQuery = useQuery({ queryKey: ["customer-jobs", id], queryFn: () => fetchJobs({ customer_id: id! }), enabled: !!id && activeTab === "jobs", retry: 1 });
  const quotesQuery = useQuery({ queryKey: ["customer-quotes", id], queryFn: () => fetchQuotes({ customer_id: id! }), enabled: !!id && activeTab === "quotes", retry: 1 });
  const membershipsQuery = useQuery({ queryKey: ["customer-memberships", id], queryFn: () => fetchMemberships({ customer_id: id! }), enabled: !!id && (activeTab === "payments" || activeTab === "info"), retry: 1 });

  // Optimistic send
  const sendMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) => sendSms(to, message),
    onMutate: async ({ message }) => {
      await queryClient.cancelQueries({ queryKey: ["inbox-thread", id] });
      const previous = queryClient.getQueryData(["inbox-thread", id]);
      queryClient.setQueryData(["inbox-thread", id], (old: any) => ({
        ...old,
        messages: [{ id: `opt-${Date.now()}`, customer_id: Number(id), role: "assistant", content: message, timestamp: new Date().toISOString(), direction: "outbound", ai_generated: false }, ...(old?.messages ?? [])],
      }));
      setNewMessage("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { previous };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox-thread", id] }),
    onError: (err: Error, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(["inbox-thread", id], ctx.previous); Alert.alert("Failed to send", err.message); },
  });

  // Edit customer mutation
  const editMutation = useMutation({
    mutationFn: (data: Record<string, string>) => updateCustomer(String(id), data),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); queryClient.invalidateQueries({ queryKey: ["customers"] }); setEditModalVisible(false); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Derived data
  const rawMessages: Message[] = (threadQuery.data as any)?.messages ?? [];
  const messages = [...rawMessages].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  const jobs: Job[] = (jobsQuery.data as any)?.data ?? (jobsQuery.data as any)?.jobs ?? [];
  const quotes: Quote[] = (quotesQuery.data as any)?.quotes ?? (quotesQuery.data as any)?.data ?? [];
  const memberships: any[] = (membershipsQuery.data as any)?.memberships ?? (membershipsQuery.data as any)?.data?.memberships ?? (membershipsQuery.data as any)?.data ?? [];

  if (customersQuery.isLoading) return <LoadingScreen />;
  if (!customer) return <ErrorState message={`Customer #${id} not found`} onRetry={() => customersQuery.refetch()} />;

  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.phone_number || "Customer";

  const openEditModal = () => {
    setEditForm({
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: (customer as any).notes || "",
    });
    setEditModalVisible(true);
  };

  // Payment handlers
  const handleDeposit = async () => {
    try {
      const res: any = await generatePaymentLink({ customerId: String(id), type: "deposit" });
      Alert.alert("Deposit Link", res.paymentUrl || res.data?.paymentUrl || "Link generated");
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleInvoice = async () => {
    try {
      await sendInvoice({ customer_id: id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Invoice sent");
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleCharge = async () => {
    const amt = parseFloat(chargeAmount);
    if (!amt || amt <= 0) { Alert.alert("Invalid", "Enter a valid amount"); return; }
    Alert.alert("Charge Card", `Charge $${amt.toFixed(2)} to this customer's card on file?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Charge", onPress: async () => {
        try {
          await chargeCard(String(id), amt);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Success", `$${amt.toFixed(2)} charged`);
          setChargeAmount("");
        } catch (err: any) { Alert.alert("Error", err.message); }
      }},
    ]);
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "messages", label: "Chat", icon: "chatbubble-outline" },
    { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
    { key: "quotes", label: "Quotes", icon: "document-text-outline" },
    { key: "payments", label: "Pay", icon: "card-outline" },
    { key: "info", label: "Info", icon: "information-circle-outline" },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.container} keyboardVerticalOffset={112}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.avatar}><Text style={st.avatarText}>{(customerName[0] || "?").toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.headerName}>{customerName}</Text>
          <Text style={st.headerPhone}>{customer.phone_number}</Text>
        </View>
        <TouchableOpacity onPress={openEditModal} style={st.editBtn}>
          <Ionicons name="pencil-outline" size={18} color={Theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBar} contentContainerStyle={{ gap: 0 }}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[st.tab, activeTab === tab.key && st.tabActive]}>
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <View style={{ flex: 1 }}>
          <FlatList data={messages} inverted keyExtractor={(item, i) => item.id?.toString() ?? i.toString()} contentContainerStyle={{ padding: 16, gap: 6 }}
            renderItem={({ item }) => {
              const isOut = item.direction === "outbound" || item.role === "assistant";
              return (
                <View style={[st.bubble, isOut ? st.bubbleOut : st.bubbleIn]}>
                  <Text style={isOut ? st.bubbleTextOut : st.bubbleTextIn}>{item.content}</Text>
                  <Text style={[st.bubbleTime, isOut && { color: "rgba(255,255,255,0.5)" }]}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    {item.ai_generated ? " • AI" : ""}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={st.emptyText}>{threadQuery.isLoading ? "Loading..." : "No messages yet"}</Text>}
          />
          <View style={st.inputBar}>
            <TextInput value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." placeholderTextColor={Theme.mutedForeground} multiline style={st.msgInput} />
            <TouchableOpacity onPress={() => { if (newMessage.trim() && customer?.phone_number) sendMutation.mutate({ to: customer.phone_number, message: newMessage.trim() }); }} disabled={!newMessage.trim()} style={[st.sendBtn, newMessage.trim() ? { backgroundColor: Theme.primary } : {}]}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Jobs Tab */}
      {activeTab === "jobs" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {jobs.length === 0 ? <Text style={st.emptyText}>{jobsQuery.isLoading ? "Loading..." : "No jobs"}</Text> : jobs.map((job, i) => (
            <GlassCard key={job.id || i}>
              <View style={st.row}><Text style={st.itemTitle}>{job.service_type || "Service"}</Text>
                <View style={[st.badge, { backgroundColor: job.status === "completed" ? Theme.successBg : "rgba(113,113,122,0.1)" }]}>
                  <Text style={[st.badgeText, { color: job.status === "completed" ? Theme.success : Theme.zinc400 }]}>{job.status || "scheduled"}</Text>
                </View>
              </View>
              <Text style={st.meta}>{job.date || job.scheduled_date || ""} {job.scheduled_time || ""}</Text>
              {job.price != null && <Text style={{ color: Theme.success, fontWeight: "600", fontSize: 13 }}>${job.price}</Text>}
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Quotes Tab */}
      {activeTab === "quotes" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {quotes.length === 0 ? <Text style={st.emptyText}>No quotes</Text> : quotes.map((q, i) => (
            <GlassCard key={q.id || i}>
              <View style={st.row}>
                <Text style={st.itemTitle}>Quote #{q.id?.toString().slice(-6)}</Text>
                <View style={[st.badge, { backgroundColor: q.status === "accepted" ? Theme.successBg : Theme.infoBg }]}>
                  <Text style={[st.badgeText, { color: q.status === "accepted" ? Theme.success : Theme.info }]}>{q.status}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: Theme.foreground }}>${q.total}</Text>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <GlassCard>
            <Text style={st.sectionTitle}>Payment Actions</Text>
            <TouchableOpacity onPress={handleDeposit} style={st.payAction}>
              <Ionicons name="link-outline" size={20} color={Theme.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.payActionTitle}>Generate Deposit Link</Text>
                <Text style={st.payActionDesc}>Send a 50% deposit payment link</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleInvoice} style={st.payAction}>
              <Ionicons name="receipt-outline" size={20} color={Theme.warning} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.payActionTitle}>Send Invoice</Text>
                <Text style={st.payActionDesc}>Email an invoice to this customer</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.mutedForeground} />
            </TouchableOpacity>
            <View style={st.chargeRow}>
              <Ionicons name="card-outline" size={20} color={Theme.success} />
              <TextInput value={chargeAmount} onChangeText={setChargeAmount} placeholder="Amount" placeholderTextColor={Theme.mutedForeground} keyboardType="decimal-pad" style={st.chargeInput} />
              <TouchableOpacity onPress={handleCharge} style={st.chargeBtn}>
                <Text style={st.chargeBtnText}>Charge Card</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
          {memberships.length > 0 && (
            <GlassCard>
              <Text style={st.sectionTitle}>Memberships</Text>
              {memberships.map((m: any, i: number) => (
                <View key={m.id || i} style={st.membershipRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.itemTitle}>{m.service_plan?.name || m.plan_name || m.name || "Plan"}</Text>
                    <Text style={st.meta}>Visits: {m.visits_used ?? 0}/{m.visits_total ?? 0}</Text>
                    {(m.renewal_date || m.next_billing_date) && (
                      <Text style={st.meta}>Renews: {new Date(m.renewal_date || m.next_billing_date).toLocaleDateString()}</Text>
                    )}
                  </View>
                  <View style={[st.badge, { backgroundColor: m.status === "active" ? Theme.successBg : Theme.destructiveBg }]}>
                    <Text style={[st.badgeText, { color: m.status === "active" ? Theme.success : Theme.destructive }]}>{m.status}</Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}
        </ScrollView>
      )}

      {/* Info Tab */}
      {activeTab === "info" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <GlassCard>
            {([
              ["Phone", customer.phone_number], ["Email", customer.email], ["Address", customer.address],
              ["Bedrooms", customer.bedrooms?.toString()], ["Bathrooms", customer.bathrooms?.toString()],
              ["Sq. Footage", customer.square_footage?.toString() || (customer as any).sqft?.toString()],
              ["Lead Source", customer.lead_source], ["Lifecycle", customer.lifecycle_stage],
              ["SMS Opt-Out", customer.sms_opt_out ? "Yes" : "No"],
              ["Card on File", (customer as any).card_on_file_at ? "Yes" : "No"],
              ["Created", customer.created_at ? new Date(customer.created_at).toLocaleDateString() : undefined],
            ] as [string, string | undefined][]).filter(([_, v]) => v).map(([label, value]) => (
              <View key={label} style={st.infoRow}>
                <Text style={{ color: Theme.mutedForeground, fontSize: 14 }}>{label}</Text>
                <Text style={{ color: Theme.foreground, fontWeight: "500", fontSize: 14 }}>{value}</Text>
              </View>
            ))}
          </GlassCard>

          {/* Memberships in Info tab */}
          <Text style={st.sectionTitle}>Memberships</Text>
          {membershipsQuery.isLoading ? (
            <Text style={st.emptyText}>Loading memberships...</Text>
          ) : memberships.length === 0 ? (
            <Text style={st.emptyText}>No active memberships</Text>
          ) : (
            memberships.map((m: any, i: number) => (
              <GlassCard key={m.id || i}>
                <View style={st.row}>
                  <Text style={st.itemTitle}>{m.service_plan?.name || m.plan_name || m.name || "Membership"}</Text>
                  <View style={[st.badge, { backgroundColor: m.status === "active" ? Theme.successBg : Theme.destructiveBg }]}>
                    <Text style={[st.badgeText, { color: m.status === "active" ? Theme.success : Theme.destructive }]}>{m.status || "unknown"}</Text>
                  </View>
                </View>
                <Text style={st.meta}>Visits: {m.visits_used ?? 0}/{m.visits_total ?? 0}</Text>
                {(m.renewal_date || m.next_billing_date) && (
                  <Text style={st.meta}>Renews: {new Date(m.renewal_date || m.next_billing_date).toLocaleDateString()}</Text>
                )}
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}

      {/* Edit Customer Modal */}
      <Modal visible={editModalVisible} onClose={() => setEditModalVisible(false)} title="Edit Customer">
        <InputField label="First Name" value={editForm.first_name || ""} onChangeText={(v) => setEditForm((p) => ({ ...p, first_name: v }))} />
        <InputField label="Last Name" value={editForm.last_name || ""} onChangeText={(v) => setEditForm((p) => ({ ...p, last_name: v }))} />
        <InputField label="Email" value={editForm.email || ""} onChangeText={(v) => setEditForm((p) => ({ ...p, email: v }))} />
        <InputField label="Address" value={editForm.address || ""} onChangeText={(v) => setEditForm((p) => ({ ...p, address: v }))} />
        <InputField label="Notes" value={editForm.notes || ""} onChangeText={(v) => setEditForm((p) => ({ ...p, notes: v }))} />
        <View style={{ marginTop: 8 }}>
          <ActionButton title="Save Changes" onPress={() => editMutation.mutate(editForm)} variant="primary" loading={editMutation.isPending} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Theme.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: Theme.primaryLight },
  headerName: { fontSize: 17, fontWeight: "600", color: Theme.foreground },
  headerPhone: { fontSize: 13, color: Theme.mutedForeground },
  editBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.primaryMuted },
  tabBar: { borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card, maxHeight: 48 },
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Theme.primary },
  tabText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12 },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: Theme.primary },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: Theme.glassCard, borderWidth: 1, borderColor: Theme.glassCardBorder },
  bubbleTextOut: { color: "#fff", fontSize: 14 },
  bubbleTextIn: { color: Theme.foreground, fontSize: 14 },
  bubbleTime: { fontSize: 11, color: Theme.mutedForeground, marginTop: 4 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.card, gap: 8 },
  msgInput: { flex: 1, maxHeight: 96, borderRadius: 12, backgroundColor: Theme.muted, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Theme.foreground },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.zinc700, alignItems: "center", justifyContent: "center" },
  emptyText: { color: Theme.mutedForeground, textAlign: "center", paddingVertical: 24, fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground, flex: 1 },
  meta: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  payAction: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  payActionTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  payActionDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  chargeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12 },
  chargeInput: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 10, color: Theme.foreground, fontSize: 15 },
  chargeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: Theme.success },
  chargeBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  membershipRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
});
