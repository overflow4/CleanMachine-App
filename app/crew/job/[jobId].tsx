import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet, Linking, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCrewJob, crewJobAction, crewJobUpdate, crewJobCharge, crewJobTipLink, fetchCrewJobMessages, sendCrewJobMessage } from "@/lib/crew-api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

export default function CrewJobDetailScreen() {
  const { jobId, token } = useLocalSearchParams<{ jobId: string; token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [msgInput, setMsgInput] = useState("");
  const [showMessages, setShowMessages] = useState(false);

  const jobQuery = useQuery({ queryKey: ["crew-job", token, jobId], queryFn: () => fetchCrewJob(token!, jobId!), enabled: !!token && !!jobId });
  const msgQuery = useQuery({ queryKey: ["crew-job-msgs", token, jobId], queryFn: () => fetchCrewJobMessages(token!, jobId!), enabled: !!token && !!jobId && showMessages, refetchInterval: showMessages ? 15000 : false });

  const actionMut = useMutation({
    mutationFn: (action: "accept" | "decline" | "cancel_accepted") => crewJobAction(token!, jobId!, action),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: ["crew-job"] }); qc.invalidateQueries({ queryKey: ["crew-dashboard"] }); },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: Record<string, any>) => crewJobUpdate(token!, jobId!, data),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: ["crew-job"] }); },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });
  const chargeMut = useMutation({
    mutationFn: () => crewJobCharge(token!, jobId!),
    onSuccess: (r: any) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Charged", `$${r.amount || ""} charged`); qc.invalidateQueries({ queryKey: ["crew-job"] }); },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });
  const tipMut = useMutation({
    mutationFn: () => crewJobTipLink(token!, jobId!),
    onSuccess: () => { Alert.alert("Sent", "Tip link sent to customer"); },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });
  const sendMsgMut = useMutation({
    mutationFn: (content: string) => sendCrewJobMessage(token!, jobId!, content),
    onSuccess: () => { setMsgInput(""); qc.invalidateQueries({ queryKey: ["crew-job-msgs"] }); },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  if (jobQuery.isLoading) return <LoadingScreen />;
  const d = jobQuery.data;
  if (!d) return <LoadingScreen message="No data" />;

  const { job, assignment, customer, checklist, tenant } = d;
  const isPending = assignment?.status === "pending";
  const isActive = !isPending && job.status !== "completed" && job.status !== "cancelled";
  const isDone = job.status === "completed";
  const messages = msgQuery.data?.messages ?? [];
  const completedChecklist = checklist.filter((c) => c.completed).length;
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ");

  // Determine next step
  const nextStep = !job.cleaner_omw_at ? "omw" : !job.cleaner_arrived_at ? "here" : "done";
  const stepLabels: Record<string, string> = { omw: "I'm On My Way", here: "I've Arrived", done: "Mark Complete" };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.headerTenant}>{tenant?.name}</Text>
          <Text style={st.headerTitle}>{job.service_type} #{jobId}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Job Info */}
        <GlassCard>
          <Text style={st.jobDate}>{new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
          {job.scheduled_at && <Text style={st.jobTime}>{new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>}
          <TouchableOpacity onPress={() => job.address && Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(job.address)}`)}>
            <Text style={st.jobAddress}>{job.address}</Text>
          </TouchableOpacity>
          <Text style={st.customerName}>{customerName}</Text>
          {customer.phone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
              <Text style={st.phoneLink}>{customer.phone}</Text>
            </TouchableOpacity>
          )}
          {/* Property pills */}
          <View style={st.pillRow}>
            {job.bedrooms != null && <View style={st.pill}><Text style={st.pillText}>{job.bedrooms} bed</Text></View>}
            {job.bathrooms != null && <View style={st.pill}><Text style={st.pillText}>{job.bathrooms} bath</Text></View>}
            {job.sqft != null && <View style={st.pill}><Text style={st.pillText}>{job.sqft} sqft</Text></View>}
            {job.hours_per_cleaner != null && <View style={st.pill}><Text style={st.pillText}>{job.hours_per_cleaner}h</Text></View>}
            {job.num_cleaners > 1 && <View style={st.pill}><Text style={st.pillText}>{job.num_cleaners} crew</Text></View>}
          </View>
          <Text style={st.pay}>${job.cleaner_pay || job.price || 0}</Text>
          {job.notes && <Text style={st.notes}>{job.notes}</Text>}
        </GlassCard>

        {/* Accept / Decline */}
        {isPending && (
          <GlassCard style={{ borderColor: "rgba(249,115,22,0.3)" }}>
            <Text style={st.sectionTitle}>This job needs your response</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[st.actionBtn, { backgroundColor: Theme.success, flex: 1 }]} onPress={() => actionMut.mutate("accept")}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={st.actionBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.actionBtn, { backgroundColor: Theme.destructive, flex: 1 }]} onPress={() => actionMut.mutate("decline")}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={st.actionBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Step Tracker */}
        {isActive && (
          <GlassCard>
            <View style={st.stepRow}>
              {["omw", "here", "done"].map((step, i) => {
                const completed = step === "omw" ? !!job.cleaner_omw_at : step === "here" ? !!job.cleaner_arrived_at : isDone;
                const isCurrent = step === nextStep;
                return (
                  <View key={step} style={st.stepItem}>
                    <View style={[st.stepCircle, completed && st.stepDone, isCurrent && st.stepCurrent]}>
                      {completed ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={st.stepNum}>{i + 1}</Text>}
                    </View>
                    <Text style={[st.stepLabel, completed && { color: Theme.success }]}>{["OMW", "Arrived", "Complete"][i]}</Text>
                    {i < 2 && <View style={[st.stepLine, completed && { backgroundColor: Theme.success }]} />}
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={[st.nextStepBtn, { backgroundColor: nextStep === "done" ? Theme.success : Theme.primary }]} onPress={() => {
              if (nextStep === "done") Alert.alert("Complete Job", "Mark this job as done?", [{ text: "Cancel" }, { text: "Complete", onPress: () => updateMut.mutate({ status: "done" }) }]);
              else updateMut.mutate({ status: nextStep });
            }}>
              <Text style={st.nextStepBtnText}>{stepLabels[nextStep]}</Text>
            </TouchableOpacity>
            {!job.cleaner_omw_at && (
              <TouchableOpacity style={st.cantMakeIt} onPress={() => Alert.alert("Can't Make It", "Cancel your accepted assignment?", [{ text: "No" }, { text: "Yes", style: "destructive", onPress: () => actionMut.mutate("cancel_accepted") }])}>
                <Text style={st.cantMakeItText}>Can't Make It</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <GlassCard>
            <Text style={st.sectionTitle}>Checklist ({completedChecklist}/{checklist.length})</Text>
            <View style={st.progressBar}><View style={[st.progressFill, { width: `${(completedChecklist / checklist.length) * 100}%` }]} /></View>
            {checklist.map((item) => (
              <TouchableOpacity key={item.id} style={[st.checkItem, item.completed && { opacity: 0.5 }]} onPress={() => updateMut.mutate({ checklist_item_id: item.id, completed: !item.completed })}>
                <Ionicons name={item.completed ? "checkmark-circle" : "ellipse-outline"} size={22} color={item.completed ? Theme.success : Theme.mutedForeground} />
                <Text style={[st.checkText, item.completed && st.checkDone]}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}

        {/* Payment Method */}
        {isActive && !job.card_on_file && (
          <GlassCard>
            <Text style={st.sectionTitle}>Payment Method</Text>
            <View style={st.paymentGrid}>
              {["card", "cash", "check", "venmo"].map((m) => (
                <TouchableOpacity key={m} style={[st.paymentBtn, job.payment_method === m && st.paymentBtnActive]} onPress={() => updateMut.mutate({ payment_method: m })}>
                  <Ionicons name={m === "card" ? "card-outline" : m === "cash" ? "cash-outline" : m === "check" ? "document-text-outline" : "logo-venmo"} size={20} color={job.payment_method === m ? Theme.primary : Theme.mutedForeground} />
                  <Text style={[st.paymentBtnText, job.payment_method === m && { color: Theme.primary }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        )}

        {/* Charge Card */}
        {isDone && job.card_on_file && !job.paid && (
          <TouchableOpacity style={[st.actionBtn, { backgroundColor: Theme.success }]} onPress={() => Alert.alert("Charge Card", "Charge the customer's card on file?", [{ text: "Cancel" }, { text: "Charge", onPress: () => chargeMut.mutate() }])}>
            <Ionicons name="card" size={20} color="#fff" />
            <Text style={st.actionBtnText}>Charge Card on File</Text>
          </TouchableOpacity>
        )}

        {/* Paid Banner */}
        {isDone && job.paid && (
          <View style={st.paidBanner}><Ionicons name="checkmark-circle" size={20} color={Theme.success} /><Text style={{ color: Theme.success, fontWeight: "600" }}>Payment Received</Text></View>
        )}

        {/* Tip Link */}
        {isDone && (
          <TouchableOpacity style={[st.actionBtn, { backgroundColor: "rgba(236,72,153,0.1)", borderWidth: 1, borderColor: "rgba(236,72,153,0.3)" }]} onPress={() => tipMut.mutate()}>
            <Ionicons name="heart-outline" size={18} color="#ec4899" />
            <Text style={[st.actionBtnText, { color: "#ec4899" }]}>Send Tip Link</Text>
          </TouchableOpacity>
        )}

        {/* Messages */}
        <TouchableOpacity style={st.toggleMessages} onPress={() => setShowMessages(!showMessages)}>
          <Ionicons name="chatbubbles-outline" size={18} color={Theme.primary} />
          <Text style={{ color: Theme.primary, fontWeight: "500", flex: 1, marginLeft: 8 }}>Messages</Text>
          <Ionicons name={showMessages ? "chevron-up" : "chevron-down"} size={18} color={Theme.mutedForeground} />
        </TouchableOpacity>
        {showMessages && (
          <GlassCard>
            {messages.length === 0 ? <Text style={{ color: Theme.mutedForeground, textAlign: "center", paddingVertical: 16 }}>No messages</Text> :
              messages.map((m, i) => (
                <View key={m.id || i} style={[st.msgBubble, m.is_mine ? st.msgMine : st.msgTheirs]}>
                  <Text style={m.is_mine ? st.msgTextMine : st.msgTextTheirs}>{m.content}</Text>
                  <Text style={st.msgTime}>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              ))
            }
            <View style={st.msgInputRow}>
              <TextInput value={msgInput} onChangeText={setMsgInput} placeholder="Message..." placeholderTextColor={Theme.mutedForeground} style={st.msgInput} />
              <TouchableOpacity onPress={() => { if (msgInput.trim()) sendMsgMut.mutate(msgInput.trim()); }} disabled={!msgInput.trim()} style={[st.msgSend, msgInput.trim() ? { backgroundColor: Theme.primary } : {}]}>
                <Ionicons name="send" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Theme.border },
  headerTenant: { fontSize: 11, color: Theme.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  jobDate: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  jobTime: { fontSize: 14, color: Theme.primaryLight, marginTop: 2 },
  jobAddress: { fontSize: 14, color: Theme.primary, textDecorationLine: "underline", marginTop: 6 },
  customerName: { fontSize: 15, fontWeight: "500", color: Theme.foreground, marginTop: 8 },
  phoneLink: { fontSize: 14, color: Theme.primary, marginTop: 2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: Theme.muted },
  pillText: { fontSize: 12, color: Theme.mutedForeground },
  pay: { fontSize: 28, fontWeight: "700", color: Theme.success, marginTop: 10 },
  notes: { fontSize: 13, color: Theme.mutedForeground, marginTop: 6, fontStyle: "italic" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  stepItem: { alignItems: "center", flexDirection: "row" },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Theme.muted, alignItems: "center", justifyContent: "center" },
  stepDone: { backgroundColor: Theme.success },
  stepCurrent: { backgroundColor: Theme.primary },
  stepNum: { fontSize: 12, fontWeight: "600", color: Theme.mutedForeground },
  stepLabel: { fontSize: 10, color: Theme.mutedForeground, marginLeft: 4, marginRight: 4 },
  stepLine: { width: 24, height: 2, backgroundColor: Theme.border },
  nextStepBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  nextStepBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cantMakeIt: { marginTop: 8, alignItems: "center" },
  cantMakeItText: { fontSize: 13, color: Theme.destructive },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: Theme.muted, marginBottom: 10 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: Theme.success },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkText: { fontSize: 14, color: Theme.foreground, flex: 1 },
  checkDone: { textDecorationLine: "line-through", color: Theme.mutedForeground },
  paymentGrid: { flexDirection: "row", gap: 8 },
  paymentBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: Theme.border, gap: 4 },
  paymentBtnActive: { borderColor: Theme.primary, backgroundColor: Theme.primaryMuted },
  paymentBtnText: { fontSize: 11, fontWeight: "500", color: Theme.mutedForeground, textTransform: "capitalize" },
  paidBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: Theme.successBg, borderWidth: 1, borderColor: "rgba(69,186,80,0.3)" },
  toggleMessages: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  msgBubble: { maxWidth: "80%", borderRadius: 14, padding: 10, marginBottom: 6 },
  msgMine: { alignSelf: "flex-end", backgroundColor: Theme.primary },
  msgTheirs: { alignSelf: "flex-start", backgroundColor: Theme.muted },
  msgTextMine: { color: "#fff", fontSize: 14 },
  msgTextTheirs: { color: Theme.foreground, fontSize: 14 },
  msgTime: { fontSize: 10, color: Theme.mutedForeground, marginTop: 4 },
  msgInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  msgInput: { flex: 1, borderRadius: 10, backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 8, color: Theme.foreground, fontSize: 14 },
  msgSend: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.zinc700, alignItems: "center", justifyContent: "center" },
});
