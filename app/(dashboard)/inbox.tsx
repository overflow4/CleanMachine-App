import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetchInboxConversations, fetchInboxThread, inboxAction, sendSms } from "@/lib/api";
import { Conversation, Message } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Theme } from "@/constants/colors";

export default function InboxScreen() {
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const queryClient = useQueryClient();

  const convosQuery = useQuery({
    queryKey: ["inbox-conversations"],
    queryFn: fetchInboxConversations,
  });

  const threadQuery = useQuery({
    queryKey: ["inbox-thread", selectedConvo?.customer_id],
    queryFn: () => fetchInboxThread(selectedConvo!.customer_id),
    enabled: !!selectedConvo,
  });

  const conversations: Conversation[] = (convosQuery.data as any)?.conversations ?? [];
  const messages: Message[] = (threadQuery.data as any)?.messages ?? [];

  const actionMutation = useMutation({
    mutationFn: ({ action, customerId }: { action: "take_over" | "release" | "resolve"; customerId: number }) =>
      inboxAction(action, customerId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
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

  const priorityVariant = (p?: string) => {
    switch (p) {
      case "hot_lead":
        return "error";
      case "needs_attention":
        return "warning";
      case "human_active":
        return "info";
      default:
        return "default";
    }
  };

  if (selectedConvo) {
    return (
      <View style={styles.container}>
        {/* Thread Header */}
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={() => setSelectedConvo(null)}>
            <Ionicons name="arrow-back" size={24} color={Theme.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.headerName}>{selectedConvo.customer_name}</Text>
            <Text style={styles.headerSub}>{selectedConvo.phone_number}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() =>
                actionMutation.mutate({
                  action: "take_over",
                  customerId: selectedConvo.customer_id,
                })
              }
            >
              <Ionicons name="hand-left-outline" size={22} color={Theme.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                actionMutation.mutate({
                  action: "resolve",
                  customerId: selectedConvo.customer_id,
                })
              }
            >
              <Ionicons name="checkmark-circle-outline" size={22} color={Theme.success} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
          inverted
          style={styles.messageList}
          renderItem={({ item }) => {
            const isOutbound = item.direction === "outbound" || item.role === "assistant";
            return (
              <View
                style={[
                  styles.msgBubble,
                  isOutbound ? styles.outboundBubble : styles.inboundBubble,
                  isOutbound ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                ]}
              >
                <Text style={isOutbound ? styles.outboundText : styles.inboundText}>
                  {item.content}
                </Text>
                <Text style={[styles.msgTime, isOutbound ? { color: "rgba(255,255,255,0.6)" } : {}]}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  {item.ai_generated ? " • AI" : ""}
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
        <View style={styles.inputBar}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Theme.mutedForeground}
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity
            onPress={() => {
              if (newMessage.trim() && selectedConvo.phone_number) {
                sendMutation.mutate({ to: selectedConvo.phone_number, message: newMessage.trim() });
              }
            }}
            disabled={!newMessage.trim()}
            style={[
              styles.sendBtn,
              newMessage.trim() ? styles.sendBtnActive : styles.sendBtnDisabled,
            ]}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (convosQuery.isLoading) {
    return <LoadingScreen message="Loading inbox..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.customer_id.toString()}
        refreshControl={
          <RefreshControl refreshing={convosQuery.isRefetching} onRefresh={() => convosQuery.refetch()} tintColor={Theme.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedConvo(item)}
            style={styles.convoItem}
          >
            <View style={styles.row}>
              <View style={styles.convoAvatar}>
                <Text style={styles.convoAvatarText}>
                  {item.customer_name?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.nameText}>{item.customer_name}</Text>
                  {item.priority && (
                    <Badge
                      label={item.priority.replace(/_/g, " ")}
                      variant={priorityVariant(item.priority)}
                    />
                  )}
                </View>
                <Text style={styles.lastMsg} numberOfLines={1}>{item.last_message}</Text>
                <Text style={styles.timeText}>
                  {item.last_message_at
                    ? new Date(item.last_message_at).toLocaleString()
                    : ""}
                </Text>
              </View>
              {(item.unread_count ?? 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState icon="mail-outline" title="Inbox empty" description="No conversations to show" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerName: {
    fontWeight: "600",
    color: Theme.foreground,
  },
  headerSub: {
    fontSize: 11,
    color: Theme.mutedForeground,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  msgBubble: {
    marginBottom: 8,
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
  },
  outboundBubble: {
    backgroundColor: Theme.primary,
  },
  inboundBubble: {
    backgroundColor: Theme.card,
  },
  outboundText: {
    color: "#ffffff",
    fontSize: 15,
  },
  inboundText: {
    color: Theme.foreground,
    fontSize: 15,
  },
  msgTime: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    backgroundColor: Theme.card,
    padding: 12,
  },
  textInput: {
    flex: 1,
    marginRight: 8,
    maxHeight: 96,
    borderRadius: 12,
    backgroundColor: Theme.muted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Theme.foreground,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: Theme.primary,
  },
  sendBtnDisabled: {
    backgroundColor: Theme.zinc600,
  },
  convoItem: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Theme.glassListItem,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  convoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  convoAvatarText: {
    fontWeight: "600",
    color: Theme.info,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  lastMsg: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  timeText: {
    fontSize: 11,
    color: Theme.zinc400,
  },
  unreadBadge: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
});
