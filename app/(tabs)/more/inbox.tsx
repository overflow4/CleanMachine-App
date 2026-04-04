import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
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
      <View className="flex-1 bg-dark-50 dark:bg-dark-900">
        {/* Thread Header */}
        <View className="flex-row items-center border-b border-dark-200 bg-white px-4 py-3 dark:border-dark-700 dark:bg-dark-800">
          <TouchableOpacity onPress={() => setSelectedConvo(null)}>
            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-dark-900 dark:text-white">
              {selectedConvo.customer_name}
            </Text>
            <Text className="text-xs text-dark-500 dark:text-dark-400">
              {selectedConvo.phone_number}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() =>
                actionMutation.mutate({
                  action: "take_over",
                  customerId: selectedConvo.customer_id,
                })
              }
            >
              <Ionicons name="hand-left-outline" size={22} color="#f59e0b" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                actionMutation.mutate({
                  action: "resolve",
                  customerId: selectedConvo.customer_id,
                })
              }
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#22c55e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
          inverted
          className="flex-1 px-4"
          renderItem={({ item }) => (
            <View
              className={`mb-2 max-w-[80%] rounded-2xl p-3 ${
                item.direction === "outbound" || item.role === "assistant"
                  ? "self-end bg-primary-500"
                  : "self-start bg-white dark:bg-dark-800"
              }`}
            >
              <Text
                className={
                  item.direction === "outbound" || item.role === "assistant"
                    ? "text-white"
                    : "text-dark-900 dark:text-white"
                }
              >
                {item.content}
              </Text>
              <Text className={`mt-1 text-xs ${
                item.direction === "outbound" || item.role === "assistant" ? "text-blue-200" : "text-dark-400"
              }`}>
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                {item.ai_generated ? " • AI" : ""}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-dark-400">No messages</Text>
            </View>
          }
        />

        {/* Send */}
        <View className="flex-row items-end border-t border-dark-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-800">
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            multiline
            className="mr-2 max-h-24 flex-1 rounded-xl bg-dark-100 px-4 py-2.5 text-base text-dark-900 dark:bg-dark-700 dark:text-white"
          />
          <TouchableOpacity
            onPress={() => {
              if (newMessage.trim() && selectedConvo.phone_number) {
                sendMutation.mutate({ to: selectedConvo.phone_number, message: newMessage.trim() });
              }
            }}
            disabled={!newMessage.trim()}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              newMessage.trim() ? "bg-primary-500" : "bg-dark-300 dark:bg-dark-600"
            }`}
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
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.customer_id.toString()}
        refreshControl={
          <RefreshControl refreshing={convosQuery.isRefetching} onRefresh={() => convosQuery.refetch()} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedConvo(item)}
            className="mx-4 mb-2 rounded-xl bg-white p-4 dark:bg-dark-800"
          >
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Text className="font-semibold text-blue-600 dark:text-blue-400">
                  {item.customer_name?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    {item.customer_name}
                  </Text>
                  {item.priority && (
                    <Badge
                      label={item.priority.replace(/_/g, " ")}
                      variant={priorityVariant(item.priority)}
                    />
                  )}
                </View>
                <Text className="text-sm text-dark-500 dark:text-dark-400" numberOfLines={1}>
                  {item.last_message}
                </Text>
                <Text className="text-xs text-dark-400">
                  {item.last_message_at
                    ? new Date(item.last_message_at).toLocaleString()
                    : ""}
                </Text>
              </View>
              {(item.unread_count ?? 0) > 0 && (
                <View className="ml-2 h-6 w-6 items-center justify-center rounded-full bg-primary-500">
                  <Text className="text-xs font-bold text-white">{item.unread_count}</Text>
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
