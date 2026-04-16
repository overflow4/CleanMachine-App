import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchInboxConversations, fetchInboxThread, inboxAction, sendSms } from "@/lib/api";
import { Conversation, Message } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Theme } from "@/constants/colors";

type PriorityFilter = "all" | "hot_lead" | "needs_attention" | "human_active" | "ai_handling" | "waiting";

export default function InboxScreen() {
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  // ── Queries ──
  const convosQuery = useQuery({
    queryKey: ["inbox-conversations"],
    queryFn: fetchInboxConversations,
    refetchInterval: 30000,
  });

  const threadQuery = useQuery({
    queryKey: ["inbox-thread", selectedConvo?.customer_id],
    queryFn: () => fetchInboxThread(selectedConvo!.customer_id),
    enabled: !!selectedConvo,
    refetchInterval: 15000,
  });

  const conversations: Conversation[] = (convosQuery.data as any)?.conversations ?? [];
  const messages: Message[] = (threadQuery.data as any)?.messages ?? [];

  // ── Inline thread expansion ──
  const expandedThreadQueries = useMemo(() => {
    const map: Record<number, Message[]> = {};
    return map;
  }, []);

  // ── Filtered conversations ──
  const filteredConversations = useMemo(() => {
    if (priorityFilter === "all") return conversations;
    return conversations.filter((c) => c.priority === priorityFilter || c.handler_type === (priorityFilter === "ai_handling" ? "ai" : undefined));
  }, [conversations, priorityFilter]);

  // ── Mutations ──
  const actionMutation = useMutation({
    mutationFn: ({ action, customerId }: { action: "take_over" | "release" | "resolve"; customerId: number }) =>
      inboxAction(action, customerId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const sendMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) => sendSms(to, message),
    onSuccess: () => {
      setNewMessage("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["inbox-thread"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  // ── Helpers ──
  const priorityColor = (p?: string) => {
    switch (p) {
      case "hot_lead": return Theme.destructive;
      case "needs_attention": return Theme.warning;
      case "human_active": return Theme.info;
      case "ai_handling": return Theme.violet400;
      default: return Theme.mutedForeground;
    }
  };

  const priorityBg = (p?: string) => {
    switch (p) {
      case "hot_lead": return "rgba(212,9,36,0.15)";
      case "needs_attention": return "rgba(245,158,11,0.15)";
      case "human_active": return "rgba(59,130,246,0.15)";
      case "ai_handling": return "rgba(139,92,246,0.15)";
      default: return "rgba(255,255,255,0.08)";
    }
  };

  const minutesSince = (iso?: string) => {
    if (!iso) return null;
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 2) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
  };

  // ── Thread view ──
  if (selectedConvo) {
    const convo = selectedConvo;
    return (
      <View style={st.container}>
        {/* Thread Header */}
        <View style={st.threadHeader}>
          <TouchableOpacity onPress={() => setSelectedConvo(null)}>
            <Ionicons name="arrow-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={st.headerName}>{convo.customer_name}</Text>
            <Text style={st.headerSub}>{convo.phone_number}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => actionMutation.mutate({ action: "take_over", customerId: convo.customer_id })}>
              <Ionicons name="hand-left-outline" size={22} color={Theme.warning} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => actionMutation.mutate({ action: "release", customerId: convo.customer_id })}>
              <Ionicons name="hand-right-outline" size={22} color={Theme.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => actionMutation.mutate({ action: "resolve", customerId: convo.customer_id })}>
              <Ionicons name="checkmark-circle-outline" size={22} color={Theme.success} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Badges Row */}
        <View style={st.analyticsBadges}>
          {convo.priority && (
            <View style={[st.analyticsBadge, { backgroundColor: priorityBg(convo.priority) }]}>
              <Ionicons name="flag" size={12} color={priorityColor(convo.priority)} />
              <Text style={[st.analyticsBadgeText, { color: priorityColor(convo.priority) }]}>
                {convo.priority.replace(/_/g, " ")}
              </Text>
            </View>
          )}
          <View style={[st.analyticsBadge, { backgroundColor: convo.handler_type === "human" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)" }]}>
            <Ionicons
              name={convo.handler_type === "human" ? "person" : "sparkles"}
              size={12}
              color={convo.handler_type === "human" ? Theme.warning : Theme.info}
            />
            <Text style={[st.analyticsBadgeText, { color: convo.handler_type === "human" ? Theme.warning : Theme.info }]}>
              {convo.handler_type === "human" ? "Human" : "AI"}
            </Text>
          </View>
          {convo.avg_response_time != null && (
            <View style={[st.analyticsBadge, { backgroundColor: "rgba(69,186,80,0.15)" }]}>
              <Ionicons name="timer-outline" size={12} color={Theme.success} />
              <Text style={[st.analyticsBadgeText, { color: Theme.success }]}>
                {convo.avg_response_time < 60 ? `${Math.round(convo.avg_response_time)}s` : `${Math.round(convo.avg_response_time / 60)}m`}
              </Text>
            </View>
          )}
        </View>

        {/* Brain Scores */}
        {((convo as any).lead_score != null || (convo as any).churn_risk != null || (convo as any).response_likelihood != null) && (
          <View style={st.brainScores}>
            {(convo as any).lead_score != null && (
              <View style={st.brainScoreItem}>
                <Text style={st.brainScoreValue}>{(convo as any).lead_score}</Text>
                <Text style={st.brainScoreLabel}>Lead Score</Text>
              </View>
            )}
            {(convo as any).response_likelihood != null && (
              <View style={st.brainScoreItem}>
                <Text style={st.brainScoreValue}>{(convo as any).response_likelihood}%</Text>
                <Text style={st.brainScoreLabel}>Response</Text>
              </View>
            )}
            {(convo as any).churn_risk != null && (
              <View style={st.brainScoreItem}>
                <Text style={[st.brainScoreValue, { color: (convo as any).churn_risk > 50 ? Theme.destructive : Theme.success }]}>
                  {(convo as any).churn_risk}%
                </Text>
                <Text style={st.brainScoreLabel}>Churn Risk</Text>
              </View>
            )}
            {(convo as any).best_contact_hour != null && (
              <View style={st.brainScoreItem}>
                <Text style={st.brainScoreValue}>{(convo as any).best_contact_hour}:00</Text>
                <Text style={st.brainScoreLabel}>Best Hour</Text>
              </View>
            )}
            {(convo as any).segment && (
              <View style={st.brainScoreItem}>
                <Text style={[st.brainScoreValue, { fontSize: 12 }]}>{(convo as any).segment}</Text>
                <Text style={st.brainScoreLabel}>Segment</Text>
              </View>
            )}
          </View>
        )}

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
          inverted
          style={st.messageList}
          renderItem={({ item }) => {
            const isOutbound = item.direction === "outbound" || item.role === "assistant";
            return (
              <View style={[st.msgBubble, isOutbound ? st.outboundBubble : st.inboundBubble, isOutbound ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
                <Text style={isOutbound ? st.outboundText : st.inboundText}>{item.content}</Text>
                <Text style={[st.msgTime, isOutbound ? { color: "rgba(255,255,255,0.6)" } : {}]}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  {item.ai_generated ? " • AI" : ""}
                  {(item as any).source ? ` • ${(item as any).source}` : ""}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ color: Theme.zinc400 }}>No messages</Text>
            </View>
          }
        />

        {/* Send */}
        <View style={st.inputBar}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Theme.mutedForeground}
            multiline
            style={st.textInput}
          />
          <TouchableOpacity
            onPress={() => {
              if (newMessage.trim() && convo.phone_number)
                sendMutation.mutate({ to: convo.phone_number, message: newMessage.trim() });
            }}
            disabled={!newMessage.trim()}
            style={[st.sendBtn, newMessage.trim() ? st.sendBtnActive : st.sendBtnDisabled]}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Conversation list ──
  if (convosQuery.isLoading) return <LoadingScreen message="Loading inbox..." />;

  const FILTERS: { key: PriorityFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "hot_lead", label: "Hot Lead" },
    { key: "needs_attention", label: "Attention" },
    { key: "human_active", label: "Human" },
    { key: "ai_handling", label: "AI" },
  ];

  return (
    <View style={st.container}>
      {/* Priority Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setPriorityFilter(f.key)}
            style={[st.filterChip, priorityFilter === f.key && st.filterChipActive]}
          >
            <Text style={[st.filterChipText, priorityFilter === f.key && st.filterChipTextActive]}>
              {f.label}
              {f.key !== "all" && (
                <Text> ({conversations.filter((c) =>
                  f.key === "ai_handling" ? c.handler_type === "ai" : c.priority === f.key
                ).length})</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.customer_id.toString()}
        refreshControl={<RefreshControl refreshing={convosQuery.isRefetching} onRefresh={() => convosQuery.refetch()} tintColor={Theme.primary} />}
        renderItem={({ item }) => {
          const timeSince = minutesSince(item.last_message_at);
          const isExpanded = expandedThreads.has(item.customer_id);

          return (
            <TouchableOpacity onPress={() => setSelectedConvo(item)} style={st.convoItem}>
              <View style={st.row}>
                <View style={[st.convoAvatar, { borderColor: priorityColor(item.priority) + "40" }]}>
                  <Text style={st.convoAvatarText}>{item.customer_name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={st.rowBetween}>
                    <Text style={st.nameText}>{item.customer_name}</Text>
                    <Text style={st.timeAgo}>{timeSince}</Text>
                  </View>

                  {/* Badges row */}
                  <View style={st.badgeRow}>
                    {item.priority && (
                      <View style={[st.miniPill, { backgroundColor: priorityBg(item.priority) }]}>
                        <Text style={[st.miniPillText, { color: priorityColor(item.priority) }]}>
                          {item.priority.replace(/_/g, " ")}
                        </Text>
                      </View>
                    )}
                    <View style={[st.miniPill, { backgroundColor: item.handler_type === "human" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)" }]}>
                      <Text style={[st.miniPillText, { color: item.handler_type === "human" ? Theme.warning : Theme.info }]}>
                        {item.handler_type === "human" ? "Human" : "AI"}
                      </Text>
                    </View>
                    {(item as any).lead_score != null && (
                      <View style={[st.miniPill, { backgroundColor: "rgba(69,186,80,0.12)" }]}>
                        <Text style={[st.miniPillText, { color: Theme.success }]}>Score: {(item as any).lead_score}</Text>
                      </View>
                    )}
                    {(item as any).sms_opt_out && (
                      <View style={[st.miniPill, { backgroundColor: Theme.destructiveBg }]}>
                        <Text style={[st.miniPillText, { color: Theme.destructive }]}>Opted Out</Text>
                      </View>
                    )}
                  </View>

                  <Text style={st.lastMsg} numberOfLines={2}>{item.last_message}</Text>
                </View>
                {(item.unread_count ?? 0) > 0 && (
                  <View style={st.unreadBadge}>
                    <Text style={st.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState icon="mail-outline" title="No conversations" description={priorityFilter !== "all" ? "No conversations match this filter" : "No conversations to show"} />}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },

  // Filter bar
  filterBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)" },
  filterChipActive: { backgroundColor: Theme.primaryMuted },
  filterChipText: { fontSize: 12, color: Theme.mutedForeground },
  filterChipTextActive: { color: Theme.primaryLight, fontWeight: "600" },

  // Thread header
  threadHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card, paddingHorizontal: 16, paddingVertical: 12 },
  headerName: { fontWeight: "600", color: Theme.foreground },
  headerSub: { fontSize: 11, color: Theme.mutedForeground },

  // Analytics badges
  analyticsBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card },
  analyticsBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  analyticsBadgeText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  // Brain scores
  brainScores: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: "rgba(0,145,255,0.03)" },
  brainScoreItem: { alignItems: "center", minWidth: 60 },
  brainScoreValue: { fontSize: 16, fontWeight: "700", color: Theme.foreground },
  brainScoreLabel: { fontSize: 9, color: Theme.mutedForeground, marginTop: 2 },

  // Messages
  messageList: { flex: 1, paddingHorizontal: 16 },
  msgBubble: { marginBottom: 8, maxWidth: "80%", borderRadius: 16, padding: 12 },
  outboundBubble: { backgroundColor: Theme.primary },
  inboundBubble: { backgroundColor: Theme.card },
  outboundText: { color: "#ffffff", fontSize: 15 },
  inboundText: { color: Theme.foreground, fontSize: 15 },
  msgTime: { marginTop: 4, fontSize: 11, color: Theme.zinc400 },

  // Input
  inputBar: { flexDirection: "row", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.card, padding: 12 },
  textInput: { flex: 1, marginRight: 8, maxHeight: 96, borderRadius: 12, backgroundColor: Theme.muted, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Theme.foreground },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sendBtnActive: { backgroundColor: Theme.primary },
  sendBtnDisabled: { backgroundColor: Theme.zinc600 },

  // Conversation list
  convoItem: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, backgroundColor: Theme.glassListItem, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convoAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.infoBg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  convoAvatarText: { fontWeight: "600", color: Theme.info },
  nameText: { fontWeight: "500", color: Theme.foreground, flex: 1 },
  timeAgo: { fontSize: 11, color: Theme.zinc500 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  miniPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniPillText: { fontSize: 9, fontWeight: "600", textTransform: "capitalize" },
  lastMsg: { fontSize: 13, color: Theme.mutedForeground, marginTop: 4 },
  unreadBadge: { marginLeft: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: Theme.primary, alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
});
