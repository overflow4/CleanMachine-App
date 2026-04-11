import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchCustomers,
  fetchInboxThread,
  sendSms,
  fetchJobs,
  fetchQuotes,
  fetchMemberships,
  updateCustomer,
  generatePaymentLink,
  sendInvoice,
  chargeCard,
  fetchCustomerLogs,
  fetchJobInvoiceDetails,
  apiFetch,
  recurringAction,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { Theme } from "@/constants/colors";
import { Customer, Message, Job, Quote } from "@/types";

type Tab = "messages" | "calls" | "jobs" | "quotes" | "payments" | "info" | "logs";

interface CallRecord {
  id: string | number;
  direction: "inbound" | "outbound";
  duration?: number;
  duration_seconds?: number;
  outcome?: string;
  transcript?: string;
  recording_url?: string;
  created_at?: string;
  timestamp?: string;
  phone_number?: string;
  customer_name?: string;
}

interface LogEntry {
  id: string | number;
  event_type?: string;
  description?: string;
  created_at?: string;
  timestamp?: string;
}

interface TimelineItem {
  id: string;
  type: "message";
  timestamp: string;
  data: Message;
}

export default function CustomerDetailScreen() {
  const { id, tab, expand } = useLocalSearchParams<{ id: string; tab?: string; expand?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>((tab as Tab) || "messages");
  const [newMessage, setNewMessage] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [chargeAmount, setChargeAmount] = useState("");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(
    expand ? new Set([String(expand)]) : new Set()
  );
  const [enrollModalVisible, setEnrollModalVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // When deep-link params change, update tab and expand state
  useEffect(() => {
    if (tab && (tab as Tab) !== activeTab) setActiveTab(tab as Tab);
    if (expand) setExpandedTranscripts((prev) => new Set(prev).add(String(expand)));
  }, [tab, expand]);

  // ───── Customer data ─────
  const customersQuery = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => fetchCustomers(),
  });
  const allCustomers: Customer[] = useMemo(() => {
    const raw = customersQuery.data as any;
    return raw?.data?.customers ?? raw?.data ?? raw?.customers ?? [];
  }, [customersQuery.data]);
  const customer = useMemo(
    () => allCustomers.find((c) => String(c.id) === String(id)),
    [allCustomers, id],
  );

  // ───── Queries ─────
  const threadQuery = useQuery({
    queryKey: ["inbox-thread", id],
    queryFn: () => fetchInboxThread(Number(id)),
    enabled: !!id && !!customer && activeTab === "messages",
    retry: 1,
    refetchInterval: activeTab === "messages" ? 15000 : false,
  });

  const callsQuery = useQuery({
    queryKey: ["customer-calls", id],
    queryFn: () => apiFetch<{ calls?: CallRecord[]; data?: CallRecord[] }>(`/api/calls?customer_id=${id}`),
    enabled: !!id && activeTab === "calls",
    retry: 1,
    refetchInterval: activeTab === "calls" ? 15000 : false,
  });

  const jobsQuery = useQuery({
    queryKey: ["customer-jobs", id],
    queryFn: () => fetchJobs({ customer_id: id! }),
    enabled: !!id && activeTab === "jobs",
    retry: 1,
  });

  const quotesQuery = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: () => fetchQuotes({ customer_id: id! }),
    enabled: !!id && activeTab === "quotes",
    retry: 1,
  });

  const membershipsQuery = useQuery({
    queryKey: ["customer-memberships", id],
    queryFn: () => fetchMemberships({ customer_id: id! }),
    enabled: !!id && (activeTab === "payments" || activeTab === "info"),
    retry: 1,
  });

  const logsQuery = useQuery({
    queryKey: ["customer-logs", id],
    queryFn: () => fetchCustomerLogs(id),
    enabled: !!id && activeTab === "logs",
    retry: 1,
  });

  const invoiceDetailsQuery = useQuery({
    queryKey: ["customer-invoice-details", id],
    queryFn: () => fetchJobInvoiceDetails(id!),
    enabled: !!id && activeTab === "jobs",
    retry: 1,
  });

  const allPlansQuery = useQuery({
    queryKey: ["all-memberships-plans"],
    queryFn: () => fetchMemberships(),
    enabled: enrollModalVisible,
    retry: 1,
  });

  // ───── Mutations ─────

  // Optimistic send SMS
  const sendMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) => sendSms(to, message),
    onMutate: async ({ message }) => {
      await queryClient.cancelQueries({ queryKey: ["inbox-thread", id] });
      const previous = queryClient.getQueryData(["inbox-thread", id]);
      queryClient.setQueryData(["inbox-thread", id], (old: any) => ({
        ...old,
        messages: [
          {
            id: `opt-${Date.now()}`,
            customer_id: Number(id),
            role: "assistant",
            content: message,
            timestamp: new Date().toISOString(),
            direction: "outbound",
            ai_generated: false,
          },
          ...(old?.messages ?? []),
        ],
      }));
      setNewMessage("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { previous };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox-thread", id] }),
    onError: (err: Error, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["inbox-thread", id], ctx.previous);
      Alert.alert("Failed to send", err.message);
    },
  });

  // Edit customer
  const editMutation = useMutation({
    mutationFn: (data: Record<string, string>) => updateCustomer(String(id), data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEditModalVisible(false);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Delete customer
  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.back();
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Auto-response toggle
  const autoResponseMutation = useMutation({
    mutationFn: (paused: boolean) => updateCustomer(String(id), { auto_response_paused: paused } as any),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Followup sequence
  const followupMutation = useMutation({
    mutationFn: (action: "pause" | "resume") =>
      recurringAction(action, { customer_id: id }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // Enroll membership
  const enrollMutation = useMutation({
    mutationFn: (servicePlanId: string) =>
      apiFetch("/api/actions/memberships", {
        method: "POST",
        body: JSON.stringify({ customer_id: id, service_plan_id: servicePlanId }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["customer-memberships", id] });
      setEnrollModalVisible(false);
      setSelectedPlanId(null);
      Alert.alert("Success", "Customer enrolled in plan");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // ───── Derived data ─────
  const rawMessages: Message[] = (threadQuery.data as any)?.messages ?? [];
  // Chat timeline: show only SMS messages (calls have their own screen)
  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const msg of rawMessages) {
      items.push({
        id: `msg-${msg.id}`,
        type: "message",
        timestamp: msg.timestamp || "",
        data: msg,
      });
    }
    items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return items;
  }, [rawMessages]);

  const customerCalls: CallRecord[] = useMemo(() => {
    const d = callsQuery.data as any;
    return d?.calls ?? d?.data ?? [];
  }, [callsQuery.data]);

  const jobs: Job[] = useMemo(() => {
    const d = jobsQuery.data as any;
    return d?.data ?? d?.jobs ?? [];
  }, [jobsQuery.data]);

  const quotes: Quote[] = useMemo(() => {
    const d = quotesQuery.data as any;
    return d?.quotes ?? d?.data ?? [];
  }, [quotesQuery.data]);

  const memberships: any[] = useMemo(() => {
    const d = membershipsQuery.data as any;
    return d?.memberships ?? d?.data?.memberships ?? d?.data ?? [];
  }, [membershipsQuery.data]);

  const logs: LogEntry[] = useMemo(() => {
    const d = logsQuery.data as any;
    return d?.logs ?? d?.data ?? [];
  }, [logsQuery.data]);

  const invoiceDetails: Record<string, any> = useMemo(() => {
    const d = invoiceDetailsQuery.data as any;
    const arr = d?.invoices ?? d?.data ?? [];
    const map: Record<string, any> = {};
    for (const inv of arr) {
      if (inv.job_id) map[String(inv.job_id)] = inv;
    }
    return map;
  }, [invoiceDetailsQuery.data]);

  const allPlans: any[] = useMemo(() => {
    const d = allPlansQuery.data as any;
    return d?.plans ?? d?.service_plans ?? d?.data?.plans ?? d?.data?.service_plans ?? d?.memberships ?? d?.data ?? [];
  }, [allPlansQuery.data]);

  // ───── Loading / Error ─────
  if (customersQuery.isLoading) return <LoadingScreen />;
  if (!customer) return <ErrorState message={`Customer #${id} not found`} onRetry={() => customersQuery.refetch()} />;

  const customerName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.phone_number ||
    "Customer";

  // ───── Handlers ─────

  const openEditModal = () => {
    setEditForm({
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone_number: customer.phone_number || "",
      email: customer.email || "",
      address: customer.address || "",
      bedrooms: customer.bedrooms != null ? String(customer.bedrooms) : "",
      bathrooms: customer.bathrooms != null ? String(customer.bathrooms) : "",
      square_footage: customer.square_footage != null ? String(customer.square_footage) : "",
      notes: (customer as any).notes || "",
    });
    setEditModalVisible(true);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to delete ${customerName}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  const handleDeposit = async () => {
    try {
      const res: any = await generatePaymentLink({ customerId: String(id), type: "deposit" });
      Alert.alert("Deposit Link", res.paymentUrl || res.data?.paymentUrl || "Link generated");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleInvoice = async () => {
    try {
      await sendInvoice({ customer_id: id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Invoice sent");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleCharge = async () => {
    const amt = parseFloat(chargeAmount);
    if (!amt || amt <= 0) {
      Alert.alert("Invalid", "Enter a valid amount");
      return;
    }
    Alert.alert("Charge Card", `Charge $${amt.toFixed(2)} to this customer's card on file?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Charge",
        onPress: async () => {
          try {
            await chargeCard(String(id), amt);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", `$${amt.toFixed(2)} charged`);
            setChargeAmount("");
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const toggleInvoice = (jobId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleTranscript = (callId: string) => {
    setExpandedTranscripts((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "messages", label: "Chat", icon: "chatbubble-outline" },
    { key: "calls", label: "Calls", icon: "call-outline" },
    { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
    { key: "quotes", label: "Quotes", icon: "document-text-outline" },
    { key: "payments", label: "Pay", icon: "card-outline" },
    { key: "info", label: "Info", icon: "information-circle-outline" },
    { key: "logs", label: "Logs", icon: "list-outline" },
  ];

  // ───── Timeline item renderers ─────

  const renderTimelineItem = ({ item }: { item: TimelineItem }) => {
    const msg = item.data as Message;
    const isOut = msg.direction === "outbound" || msg.role === "assistant";
    return (
      <View style={[st.bubble, isOut ? st.bubbleOut : st.bubbleIn]}>
        <Text style={isOut ? st.bubbleTextOut : st.bubbleTextIn}>{msg.content}</Text>
        <Text style={[st.bubbleTime, isOut && { color: "rgba(255,255,255,0.5)" }]}>
          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          {msg.ai_generated ? " \u2022 AI" : ""}
        </Text>
      </View>
    );
  };

  // ───── Render ─────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={st.container}
      keyboardVerticalOffset={112}
    >
      {/* Header */}
      <View style={st.header}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{(customerName[0] || "?").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.headerName}>{customerName}</Text>
          <Text style={st.headerPhone}>{customer.phone_number}</Text>
        </View>
        <TouchableOpacity onPress={openEditModal} style={st.editBtn}>
          <Ionicons name="pencil-outline" size={18} color={Theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={st.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Theme.destructive} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.tabBar}
        contentContainerStyle={{ gap: 0 }}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[st.tab, activeTab === tab.key && st.tabActive]}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={activeTab === tab.key ? Theme.primary : Theme.mutedForeground}
            />
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ────── Messages Tab (unified timeline) ────── */}
      {activeTab === "messages" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={timeline}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 6 }}
            renderItem={renderTimelineItem}
            ListEmptyComponent={
              <Text style={st.emptyText}>
                {threadQuery.isLoading ? "Loading..." : "No messages yet"}
              </Text>
            }
          />
          <View style={st.inputBar}>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={Theme.mutedForeground}
              multiline
              style={st.msgInput}
            />
            <TouchableOpacity
              onPress={() => {
                if (newMessage.trim() && customer?.phone_number)
                  sendMutation.mutate({ to: customer.phone_number, message: newMessage.trim() });
              }}
              disabled={!newMessage.trim()}
              style={[st.sendBtn, newMessage.trim() ? { backgroundColor: Theme.primary } : {}]}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ────── Calls Tab ────── */}
      {activeTab === "calls" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {callsQuery.isLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator size="small" color={Theme.primary} />
              <Text style={st.emptyText}>Loading calls...</Text>
            </View>
          ) : customerCalls.length === 0 ? (
            <Text style={st.emptyText}>No calls</Text>
          ) : (
            customerCalls.map((call) => {
              const callId = String(call.id);
              const isInbound = call.direction === "inbound";
              const isExpanded = expandedTranscripts.has(callId);
              const dur = call.duration_seconds ?? call.duration ?? 0;
              return (
                <GlassCard key={callId}>
                  <View style={st.row}>
                    <View style={st.callIconWrap}>
                      <Ionicons
                        name={isInbound ? "call-outline" : "arrow-redo-outline"}
                        size={16}
                        color={isInbound ? Theme.info : Theme.success}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={st.row}>
                        <Text style={st.callDirection}>
                          {isInbound ? "Inbound Call" : "Outbound Call"}
                        </Text>
                        {call.outcome && (
                          <View
                            style={[
                              st.badge,
                              {
                                backgroundColor:
                                  call.outcome === "completed" || call.outcome === "answered"
                                    ? Theme.successBg
                                    : Theme.warningBg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                st.badgeText,
                                {
                                  color:
                                    call.outcome === "completed" || call.outcome === "answered"
                                      ? Theme.success
                                      : Theme.warning,
                                },
                              ]}
                            >
                              {call.outcome}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.meta}>
                        {call.created_at || call.timestamp
                          ? new Date(call.created_at || call.timestamp!).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                        {dur > 0 ? ` \u2022 ${formatDuration(dur)}` : ""}
                      </Text>
                    </View>
                    {call.recording_url && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(call.recording_url!)}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="play-circle-outline" size={24} color={Theme.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {call.transcript && (
                    <>
                      <TouchableOpacity
                        onPress={() => toggleTranscript(callId)}
                        style={st.transcriptToggle}
                      >
                        <Text style={st.transcriptToggleText}>
                          {isExpanded ? "Hide Transcript" : "Show Transcript"}
                        </Text>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={Theme.mutedForeground}
                        />
                      </TouchableOpacity>
                      {isExpanded && (
                        <Text style={st.transcriptText}>{call.transcript}</Text>
                      )}
                    </>
                  )}
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ────── Jobs Tab ────── */}
      {activeTab === "jobs" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {jobs.length === 0 ? (
            <Text style={st.emptyText}>{jobsQuery.isLoading ? "Loading..." : "No jobs"}</Text>
          ) : (
            jobs.map((job, i) => {
              const jobId = String(job.id || i);
              const invoice = invoiceDetails[jobId];
              const isInvoiceExpanded = expandedInvoices.has(jobId);

              return (
                <GlassCard key={jobId}>
                  <View style={st.row}>
                    <Text style={st.itemTitle}>{job.service_type || "Service"}</Text>
                    <View
                      style={[
                        st.badge,
                        {
                          backgroundColor:
                            job.status === "completed" ? Theme.successBg : "rgba(113,113,122,0.1)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          st.badgeText,
                          { color: job.status === "completed" ? Theme.success : Theme.zinc400 },
                        ]}
                      >
                        {job.status || "scheduled"}
                      </Text>
                    </View>
                  </View>
                  <Text style={st.meta}>
                    {job.date || job.scheduled_date || ""} {job.scheduled_time || ""}
                  </Text>
                  {job.price != null && (
                    <Text style={{ color: Theme.success, fontWeight: "600", fontSize: 13 }}>
                      ${job.price}
                    </Text>
                  )}

                  {/* Invoice drill-down */}
                  {invoice && (
                    <>
                      <TouchableOpacity
                        onPress={() => toggleInvoice(jobId)}
                        style={st.invoiceToggle}
                      >
                        <Ionicons name="receipt-outline" size={14} color={Theme.primary} />
                        <Text style={st.invoiceToggleText}>
                          {isInvoiceExpanded ? "Hide Invoice" : "View Invoice"}
                        </Text>
                        <Ionicons
                          name={isInvoiceExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={Theme.mutedForeground}
                        />
                      </TouchableOpacity>
                      {isInvoiceExpanded && (
                        <View style={st.invoiceDetail}>
                          {invoice.invoice_number && (
                            <View style={st.invoiceRow}>
                              <Text style={st.invoiceLabel}>Invoice #</Text>
                              <Text style={st.invoiceValue}>{invoice.invoice_number}</Text>
                            </View>
                          )}
                          {invoice.amount != null && (
                            <View style={st.invoiceRow}>
                              <Text style={st.invoiceLabel}>Amount</Text>
                              <Text style={st.invoiceValue}>${invoice.amount}</Text>
                            </View>
                          )}
                          {invoice.status && (
                            <View style={st.invoiceRow}>
                              <Text style={st.invoiceLabel}>Status</Text>
                              <View
                                style={[
                                  st.badge,
                                  {
                                    backgroundColor:
                                      invoice.status === "paid" ? Theme.successBg : Theme.warningBg,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    st.badgeText,
                                    {
                                      color:
                                        invoice.status === "paid" ? Theme.success : Theme.warning,
                                    },
                                  ]}
                                >
                                  {invoice.status}
                                </Text>
                              </View>
                            </View>
                          )}
                          {invoice.paid_at && (
                            <View style={st.invoiceRow}>
                              <Text style={st.invoiceLabel}>Paid</Text>
                              <Text style={st.invoiceValue}>
                                {new Date(invoice.paid_at).toLocaleDateString()}
                              </Text>
                            </View>
                          )}
                          {invoice.payment_method && (
                            <View style={st.invoiceRow}>
                              <Text style={st.invoiceLabel}>Method</Text>
                              <Text style={st.invoiceValue}>{invoice.payment_method}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ────── Quotes Tab ────── */}
      {activeTab === "quotes" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {quotes.length === 0 ? (
            <Text style={st.emptyText}>No quotes</Text>
          ) : (
            quotes.map((q, i) => (
              <GlassCard key={q.id || i}>
                <View style={st.row}>
                  <Text style={st.itemTitle}>Quote #{q.id?.toString().slice(-6)}</Text>
                  <View
                    style={[
                      st.badge,
                      { backgroundColor: q.status === "accepted" ? Theme.successBg : Theme.infoBg },
                    ]}
                  >
                    <Text
                      style={[
                        st.badgeText,
                        { color: q.status === "accepted" ? Theme.success : Theme.info },
                      ]}
                    >
                      {q.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: Theme.foreground }}>
                  ${q.total}
                </Text>
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}

      {/* ────── Payments Tab ────── */}
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
              <TextInput
                value={chargeAmount}
                onChangeText={setChargeAmount}
                placeholder="Amount"
                placeholderTextColor={Theme.mutedForeground}
                keyboardType="decimal-pad"
                style={st.chargeInput}
              />
              <TouchableOpacity onPress={handleCharge} style={st.chargeBtn}>
                <Text style={st.chargeBtnText}>Charge Card</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Enroll in Plan */}
          <GlassCard>
            <Text style={st.sectionTitle}>Membership Enrollment</Text>
            <TouchableOpacity
              onPress={() => setEnrollModalVisible(true)}
              style={st.payAction}
            >
              <Ionicons name="ribbon-outline" size={20} color={Theme.violet400} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.payActionTitle}>Enroll in Plan</Text>
                <Text style={st.payActionDesc}>Subscribe customer to a service plan</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.mutedForeground} />
            </TouchableOpacity>
          </GlassCard>

          {memberships.length > 0 && (
            <GlassCard>
              <Text style={st.sectionTitle}>Memberships</Text>
              {memberships.map((m: any, i: number) => (
                <View key={m.id || i} style={st.membershipRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.itemTitle}>
                      {m.service_plan?.name || m.plan_name || m.name || "Plan"}
                    </Text>
                    <Text style={st.meta}>
                      Visits: {m.visits_used ?? 0}/{m.visits_total ?? 0}
                    </Text>
                    {(m.renewal_date || m.next_billing_date) && (
                      <Text style={st.meta}>
                        Renews: {new Date(m.renewal_date || m.next_billing_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      st.badge,
                      {
                        backgroundColor:
                          m.status === "active" ? Theme.successBg : Theme.destructiveBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        st.badgeText,
                        { color: m.status === "active" ? Theme.success : Theme.destructive },
                      ]}
                    >
                      {m.status}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}
        </ScrollView>
      )}

      {/* ────── Info Tab ────── */}
      {activeTab === "info" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <GlassCard>
            {(
              [
                ["Phone", customer.phone_number],
                ["Email", customer.email],
                ["Address", customer.address],
                ["Bedrooms", customer.bedrooms?.toString()],
                ["Bathrooms", customer.bathrooms?.toString()],
                ["Sq. Footage", customer.square_footage?.toString() || (customer as any).sqft?.toString()],
                ["Lead Source", customer.lead_source],
                ["Lifecycle", customer.lifecycle_stage],
                ["SMS Opt-Out", customer.sms_opt_out ? "Yes" : "No"],
                ["Card on File", (customer as any).card_on_file_at ? "Yes" : "No"],
                ["Created", customer.created_at ? new Date(customer.created_at).toLocaleDateString() : undefined],
              ] as [string, string | undefined][]
            )
              .filter(([_, v]) => v)
              .map(([label, value]) => (
                <View key={label} style={st.infoRow}>
                  <Text style={{ color: Theme.mutedForeground, fontSize: 14 }}>{label}</Text>
                  <Text style={{ color: Theme.foreground, fontWeight: "500", fontSize: 14 }}>
                    {value}
                  </Text>
                </View>
              ))}
          </GlassCard>

          {/* AI Auto-Response Toggle */}
          <GlassCard>
            <Text style={st.sectionTitle}>AI Settings</Text>
            <View style={st.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Theme.foreground, fontSize: 14, fontWeight: "500" }}>
                  AI Auto-Response
                </Text>
                <Text style={{ color: Theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {(customer as any).auto_response_paused
                    ? "Auto-responses are paused"
                    : "AI will automatically reply to this customer"}
                </Text>
              </View>
              <Switch
                value={!(customer as any).auto_response_paused}
                onValueChange={(enabled) => autoResponseMutation.mutate(!enabled)}
                trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }}
                thumbColor={!(customer as any).auto_response_paused ? Theme.primary : Theme.mutedForeground}
                disabled={autoResponseMutation.isPending}
              />
            </View>
          </GlassCard>

          {/* Followup Sequence Controls */}
          <GlassCard>
            <Text style={st.sectionTitle}>Followup Sequence</Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: Theme.mutedForeground, fontSize: 13 }}>
                Status:{" "}
                <Text style={{ color: Theme.foreground, fontWeight: "500" }}>
                  {(customer as any).followup_paused ? "Paused" : (customer as any).followup_status || "Active"}
                </Text>
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => followupMutation.mutate("pause")}
                  disabled={followupMutation.isPending}
                  style={[st.followupBtn, { borderColor: Theme.warning }]}
                >
                  {followupMutation.isPending ? (
                    <ActivityIndicator size="small" color={Theme.warning} />
                  ) : (
                    <>
                      <Ionicons name="pause-outline" size={14} color={Theme.warning} />
                      <Text style={[st.followupBtnText, { color: Theme.warning }]}>Pause</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => followupMutation.mutate("resume")}
                  disabled={followupMutation.isPending}
                  style={[st.followupBtn, { borderColor: Theme.success }]}
                >
                  {followupMutation.isPending ? (
                    <ActivityIndicator size="small" color={Theme.success} />
                  ) : (
                    <>
                      <Ionicons name="play-outline" size={14} color={Theme.success} />
                      <Text style={[st.followupBtnText, { color: Theme.success }]}>Resume</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
                  <Text style={st.itemTitle}>
                    {m.service_plan?.name || m.plan_name || m.name || "Membership"}
                  </Text>
                  <View
                    style={[
                      st.badge,
                      {
                        backgroundColor:
                          m.status === "active" ? Theme.successBg : Theme.destructiveBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        st.badgeText,
                        { color: m.status === "active" ? Theme.success : Theme.destructive },
                      ]}
                    >
                      {m.status || "unknown"}
                    </Text>
                  </View>
                </View>
                <Text style={st.meta}>
                  Visits: {m.visits_used ?? 0}/{m.visits_total ?? 0}
                </Text>
                {(m.renewal_date || m.next_billing_date) && (
                  <Text style={st.meta}>
                    Renews: {new Date(m.renewal_date || m.next_billing_date).toLocaleDateString()}
                  </Text>
                )}
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}

      {/* ────── Logs Tab ────── */}
      {activeTab === "logs" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {logsQuery.isLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator size="small" color={Theme.primary} />
              <Text style={[st.emptyText, { paddingVertical: 8 }]}>Loading logs...</Text>
            </View>
          ) : logs.length === 0 ? (
            <Text style={st.emptyText}>No activity logs</Text>
          ) : (
            logs.map((log, i) => (
              <GlassCard key={log.id || i}>
                <View style={st.row}>
                  <View style={st.logIconWrap}>
                    <Ionicons name="time-outline" size={14} color={Theme.mutedForeground} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    {log.event_type && (
                      <View style={[st.badge, { backgroundColor: Theme.infoBg, alignSelf: "flex-start", marginBottom: 4 }]}>
                        <Text style={[st.badgeText, { color: Theme.info }]}>{log.event_type}</Text>
                      </View>
                    )}
                    <Text style={{ color: Theme.foreground, fontSize: 13 }}>
                      {log.description || "Activity recorded"}
                    </Text>
                  </View>
                  <Text style={{ color: Theme.mutedForeground, fontSize: 11 }}>
                    {log.created_at || log.timestamp
                      ? new Date(log.created_at || log.timestamp!).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </Text>
                </View>
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}

      {/* ────── Edit Customer Modal ────── */}
      <Modal visible={editModalVisible} onClose={() => setEditModalVisible(false)} title="Edit Customer">
        <InputField
          label="First Name"
          value={editForm.first_name || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, first_name: v }))}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <InputField
          label="Last Name"
          value={editForm.last_name || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, last_name: v }))}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <InputField
          label="Phone Number"
          value={editForm.phone_number || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, phone_number: v }))}
          keyboardType="phone-pad"
          returnKeyType="next"
        />
        <InputField
          label="Email"
          value={editForm.email || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, email: v }))}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
        <InputField
          label="Address"
          value={editForm.address || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, address: v }))}
          returnKeyType="next"
        />
        <InputField
          label="Bedrooms"
          value={editForm.bedrooms || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, bedrooms: v }))}
          keyboardType="number-pad"
          returnKeyType="next"
        />
        <InputField
          label="Bathrooms"
          value={editForm.bathrooms || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, bathrooms: v }))}
          keyboardType="number-pad"
          returnKeyType="next"
        />
        <InputField
          label="Square Footage"
          value={editForm.square_footage || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, square_footage: v }))}
          keyboardType="number-pad"
          returnKeyType="next"
        />
        <InputField
          label="Notes"
          value={editForm.notes || ""}
          onChangeText={(v) => setEditForm((p) => ({ ...p, notes: v }))}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />
        <View style={{ marginTop: 8 }}>
          <ActionButton
            title="Save Changes"
            onPress={() => {
              const payload: Record<string, any> = { ...editForm };
              if (payload.bedrooms) payload.bedrooms = Number(payload.bedrooms);
              if (payload.bathrooms) payload.bathrooms = Number(payload.bathrooms);
              if (payload.square_footage) payload.square_footage = Number(payload.square_footage);
              editMutation.mutate(payload);
            }}
            variant="primary"
            loading={editMutation.isPending}
          />
        </View>
      </Modal>

      {/* ────── Enroll in Plan Modal ────── */}
      <Modal
        visible={enrollModalVisible}
        onClose={() => { setEnrollModalVisible(false); setSelectedPlanId(null); }}
        title="Enroll in Plan"
      >
        {allPlansQuery.isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator size="small" color={Theme.primary} />
            <Text style={[st.emptyText, { paddingVertical: 8 }]}>Loading plans...</Text>
          </View>
        ) : allPlans.length === 0 ? (
          <Text style={st.emptyText}>No plans available</Text>
        ) : (
          allPlans.map((plan: any) => {
            const planId = String(plan.id);
            const isSelected = selectedPlanId === planId;
            return (
              <TouchableOpacity
                key={planId}
                onPress={() => setSelectedPlanId(planId)}
                style={[
                  st.planOption,
                  isSelected && { borderColor: Theme.primary, backgroundColor: Theme.primaryMuted },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[st.itemTitle, isSelected && { color: Theme.primaryLight }]}>
                    {plan.name || plan.plan_name || "Plan"}
                  </Text>
                  {plan.price != null && (
                    <Text style={st.meta}>${plan.price}/{plan.interval || "month"}</Text>
                  )}
                  {plan.description && (
                    <Text style={[st.meta, { marginTop: 2 }]}>{plan.description}</Text>
                  )}
                </View>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={isSelected ? Theme.primary : Theme.mutedForeground}
                />
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ marginTop: 12 }}>
          <ActionButton
            title="Enroll Customer"
            onPress={() => {
              if (selectedPlanId) enrollMutation.mutate(selectedPlanId);
            }}
            variant="primary"
            loading={enrollMutation.isPending}
            disabled={!selectedPlanId}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: Theme.primaryLight },
  headerName: { fontSize: 17, fontWeight: "600", color: Theme.foreground },
  headerPhone: { fontSize: 13, color: Theme.mutedForeground },
  editBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.primaryMuted },
  deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: Theme.destructiveBg },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
    maxHeight: 48,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Theme.primary },
  tabText: { fontSize: 12, fontWeight: "500", color: Theme.mutedForeground },
  tabTextActive: { color: Theme.primary },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12 },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: Theme.primary },
  bubbleIn: {
    alignSelf: "flex-start",
    backgroundColor: Theme.glassCard,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
  },
  bubbleTextOut: { color: "#fff", fontSize: 14 },
  bubbleTextIn: { color: Theme.foreground, fontSize: 14 },
  bubbleTime: { fontSize: 11, color: Theme.mutedForeground, marginTop: 4 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    backgroundColor: Theme.card,
    gap: 8,
  },
  msgInput: {
    flex: 1,
    maxHeight: 96,
    borderRadius: 12,
    backgroundColor: Theme.muted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.foreground,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.zinc700,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: Theme.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground, flex: 1 },
  meta: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  payAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  payActionTitle: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  payActionDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  chargeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12 },
  chargeInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.foreground,
    fontSize: 15,
  },
  chargeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Theme.success,
  },
  chargeBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  membershipRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  // Call styles
  callIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  callDirection: { fontSize: 13, fontWeight: "600", color: Theme.foreground },
  transcriptToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  transcriptToggleText: { fontSize: 12, color: Theme.mutedForeground },
  transcriptText: {
    fontSize: 12,
    color: Theme.foreground,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  // Invoice drill-down styles
  invoiceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  invoiceToggleText: { fontSize: 12, color: Theme.primary, flex: 1 },
  invoiceDetail: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  invoiceLabel: { fontSize: 12, color: Theme.mutedForeground },
  invoiceValue: { fontSize: 12, color: Theme.foreground, fontWeight: "500" },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },

  // Followup buttons
  followupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followupBtnText: { fontSize: 13, fontWeight: "600" },

  // Log styles
  logIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Plan selection styles
  planOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
  },
});
