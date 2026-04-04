import React, { useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchCustomer, fetchInboxThread, sendSms, fetchJobs, fetchQuotes } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { Theme } from "@/constants/colors";
import { Customer, Message, Job, Quote } from "@/types";

type Tab = "messages" | "jobs" | "quotes" | "info";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [newMessage, setNewMessage] = useState("");
  const queryClient = useQueryClient();

  const customerQuery = useQuery({ queryKey: ["customer", id], queryFn: () => fetchCustomer(id!), enabled: !!id });
  const threadQuery = useQuery({ queryKey: ["inbox-thread", id], queryFn: () => fetchInboxThread(Number(id)), enabled: !!id && activeTab === "messages" });
  const jobsQuery = useQuery({ queryKey: ["customer-jobs", id], queryFn: () => fetchJobs({ customer_id: id! }), enabled: !!id && activeTab === "jobs" });
  const quotesQuery = useQuery({ queryKey: ["customer-quotes", id], queryFn: () => fetchQuotes({ customer_id: id! }), enabled: !!id && activeTab === "quotes" });

  const sendMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) => sendSms(to, message),
    onSuccess: () => { setNewMessage(""); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); queryClient.invalidateQueries({ queryKey: ["inbox-thread", id] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const customer: Customer | undefined = customerQuery.data as any;
  const messages: Message[] = (threadQuery.data as any)?.messages ?? [];
  const jobs: Job[] = (jobsQuery.data as any)?.data ?? (jobsQuery.data as any)?.jobs ?? [];
  const quotes: Quote[] = (quotesQuery.data as any)?.quotes ?? (quotesQuery.data as any)?.data ?? [];

  if (customerQuery.isLoading) return <LoadingScreen />;
  if (customerQuery.isError) return <ErrorState message="Failed to load customer" onRetry={() => customerQuery.refetch()} />;

  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.phone_number || "Customer";
  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "messages", label: "Messages", icon: "chatbubble-outline" },
    { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
    { key: "quotes", label: "Quotes", icon: "document-text-outline" },
    { key: "info", label: "Info", icon: "information-circle-outline" },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.container} keyboardVerticalOffset={100}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarText}>{customerName[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{customerName}</Text>
          <Text style={s.headerPhone}>{customer?.phone_number}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tab, activeTab === tab.key && s.tabActive]}>
            <Ionicons name={tab.icon} size={15} color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground} />
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={messages} inverted
            keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
            contentContainerStyle={{ padding: 16, gap: 6 }}
            renderItem={({ item }) => {
              const isOut = item.direction === "outbound" || item.role === "assistant";
              return (
                <View style={[s.bubble, isOut ? s.bubbleOut : s.bubbleIn]}>
                  <Text style={isOut ? s.bubbleTextOut : s.bubbleTextIn}>{item.content}</Text>
                  <Text style={[s.bubbleTime, isOut && { color: "rgba(255,255,255,0.5)" }]}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    {item.ai_generated ? " • AI" : ""}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={s.emptyText}>No messages yet</Text>}
          />
          <View style={s.inputBar}>
            <TextInput value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." placeholderTextColor={Theme.mutedForeground} multiline style={s.msgInput} />
            <TouchableOpacity onPress={() => { if (newMessage.trim() && customer?.phone_number) sendMutation.mutate({ to: customer.phone_number, message: newMessage.trim() }); }} disabled={!newMessage.trim()} style={[s.sendBtn, newMessage.trim() ? { backgroundColor: Theme.primary } : {}]}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Jobs Tab */}
      {activeTab === "jobs" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {jobs.length === 0 ? <Text style={s.emptyText}>No jobs found</Text> : jobs.map((job, i) => (
            <GlassCard key={job.id || i}>
              <View style={s.row}><Text style={s.itemTitle}>{job.service_type || "Service"}</Text>
                <View style={[s.badge, { backgroundColor: job.status === "completed" ? Theme.successBg : "rgba(113,113,122,0.1)" }]}>
                  <Text style={[s.badgeText, { color: job.status === "completed" ? Theme.success : Theme.zinc400 }]}>{job.status || "scheduled"}</Text>
                </View>
              </View>
              <Text style={s.meta}>{job.date || job.scheduled_date || ""}</Text>
              {job.price != null && <Text style={{ color: Theme.success, fontWeight: "600", fontSize: 13 }}>${job.price}</Text>}
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Quotes Tab */}
      {activeTab === "quotes" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {quotes.length === 0 ? <Text style={s.emptyText}>No quotes found</Text> : quotes.map((quote, i) => (
            <GlassCard key={quote.id || i}>
              <View style={s.row}>
                <Text style={s.itemTitle}>Quote #{quote.id?.slice(-6)}</Text>
                <View style={[s.badge, { backgroundColor: quote.status === "accepted" ? Theme.successBg : Theme.infoBg }]}>
                  <Text style={[s.badgeText, { color: quote.status === "accepted" ? Theme.success : Theme.info }]}>{quote.status}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: Theme.foreground }}>${quote.total}</Text>
              <Text style={s.meta}>{new Date(quote.created_at).toLocaleDateString()}</Text>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Info Tab */}
      {activeTab === "info" && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <GlassCard>
            {[
              ["Phone", customer?.phone_number], ["Email", customer?.email], ["Address", customer?.address],
              ["Bedrooms", customer?.bedrooms?.toString()], ["Bathrooms", customer?.bathrooms?.toString()],
              ["Sq. Footage", customer?.square_footage?.toString()], ["Lead Source", customer?.lead_source],
              ["Lifecycle", customer?.lifecycle_stage], ["SMS Opt-Out", customer?.sms_opt_out ? "Yes" : "No"],
            ].filter(([_, v]) => v).map(([label, value]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{value}</Text>
              </View>
            ))}
          </GlassCard>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Theme.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: Theme.primaryLight },
  headerName: { fontSize: 17, fontWeight: "600", color: Theme.foreground },
  headerPhone: { fontSize: 13, color: Theme.mutedForeground },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 },
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
  itemTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  meta: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  infoLabel: { color: Theme.mutedForeground, fontSize: 14 },
  infoValue: { color: Theme.foreground, fontSize: 14, fontWeight: "500" },
});
