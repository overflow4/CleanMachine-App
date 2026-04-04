import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchCustomer,
  fetchInboxThread,
  sendSms,
  fetchJobs,
  fetchQuotes,
  fetchMemberships,
  fetchCustomerLogs,
  fetchJobInvoiceDetails,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { Customer, Message, Job, Quote } from "@/types";

type Tab = "messages" | "jobs" | "quotes" | "info";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [newMessage, setNewMessage] = useState("");
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  const threadQuery = useQuery({
    queryKey: ["inbox-thread", id],
    queryFn: () => fetchInboxThread(Number(id)),
    enabled: !!id && activeTab === "messages",
  });

  const jobsQuery = useQuery({
    queryKey: ["customer-jobs", id],
    queryFn: () => fetchJobs({ customer_id: id! }),
    enabled: !!id && activeTab === "jobs",
  });

  const quotesQuery = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: () => fetchQuotes({ customer_id: id! }),
    enabled: !!id && activeTab === "quotes",
  });

  const sendMutation = useMutation({
    mutationFn: ({ to, message }: { to: string; message: string }) =>
      sendSms(to, message),
    onSuccess: () => {
      setNewMessage("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["inbox-thread", id] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const customer: Customer | undefined = customerQuery.data as any;
  const messages: Message[] = (threadQuery.data as any)?.messages ?? [];
  const jobs: Job[] = (jobsQuery.data as any)?.data ?? (jobsQuery.data as any)?.jobs ?? [];
  const quotes: Quote[] = (quotesQuery.data as any)?.quotes ?? (quotesQuery.data as any)?.data ?? [];

  const handleSend = () => {
    if (!newMessage.trim() || !customer?.phone_number) return;
    sendMutation.mutate({ to: customer.phone_number, message: newMessage.trim() });
  };

  if (customerQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (customerQuery.isError) {
    return <ErrorState message="Failed to load customer" onRetry={() => customerQuery.refetch()} />;
  }

  const customerName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    customer?.phone_number ||
    "Customer";

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "messages", label: "Messages", icon: "chatbubble-outline" },
    { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
    { key: "quotes", label: "Quotes", icon: "document-text-outline" },
    { key: "info", label: "Info", icon: "information-circle-outline" },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      keyboardVerticalOffset={90}
    >
      {/* Customer Header */}
      <Card className="mx-4 mt-2 mb-2">
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {customerName[0]?.toUpperCase()}
            </Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-lg font-semibold text-dark-900 dark:text-white">
              {customerName}
            </Text>
            <Text className="text-sm text-dark-500 dark:text-dark-400">
              {customer?.phone_number}
            </Text>
          </View>
          {customer?.lifecycle_stage && (
            <Badge label={customer.lifecycle_stage} variant="info" />
          )}
        </View>
      </Card>

      {/* Tab Selector */}
      <View className="mx-4 mb-2 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 flex-row items-center justify-center rounded-md py-2 ${
              activeTab === tab.key
                ? "bg-white dark:bg-dark-700"
                : ""
            }`}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? "#3b82f6" : "#94a3b8"}
            />
            <Text
              className={`ml-1 text-xs font-medium ${
                activeTab === tab.key
                  ? "text-primary-500"
                  : "text-dark-500 dark:text-dark-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === "messages" && (
        <View className="flex-1">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
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
                <Text
                  className={`mt-1 text-xs ${
                    item.direction === "outbound" || item.role === "assistant"
                      ? "text-blue-200"
                      : "text-dark-400"
                  }`}
                >
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                  {item.ai_generated ? " • AI" : ""}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Text className="text-dark-400">No messages yet</Text>
              </View>
            }
          />
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
              onPress={handleSend}
              disabled={!newMessage.trim() || sendMutation.isPending}
              className={`h-10 w-10 items-center justify-center rounded-full ${
                newMessage.trim() ? "bg-primary-500" : "bg-dark-300 dark:bg-dark-600"
              }`}
            >
              <Ionicons name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === "jobs" && (
        <ScrollView className="flex-1 px-4">
          {jobs.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-dark-400">No jobs found</Text>
            </View>
          ) : (
            jobs.map((job, i) => (
              <Card key={job.id || i} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="font-medium text-dark-900 dark:text-white">
                      {job.service_type || "Service"}
                    </Text>
                    <Text className="text-sm text-dark-500 dark:text-dark-400">
                      {job.date || job.scheduled_date || job.scheduled_at || ""}
                    </Text>
                  </View>
                  <Badge
                    label={job.status || "scheduled"}
                    variant={job.status === "completed" ? "success" : "default"}
                  />
                </View>
                {job.price != null && (
                  <Text className="mt-1 text-sm font-medium text-green-600">${job.price}</Text>
                )}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "quotes" && (
        <ScrollView className="flex-1 px-4">
          {quotes.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-dark-400">No quotes found</Text>
            </View>
          ) : (
            quotes.map((quote, i) => (
              <Card key={quote.id || i} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    Quote #{quote.id?.slice(-6)}
                  </Text>
                  <Badge
                    label={quote.status}
                    variant={
                      quote.status === "accepted"
                        ? "success"
                        : quote.status === "declined"
                        ? "error"
                        : "info"
                    }
                  />
                </View>
                <Text className="mt-1 text-lg font-bold text-dark-900 dark:text-white">
                  ${quote.total}
                </Text>
                <Text className="text-sm text-dark-500 dark:text-dark-400">
                  {new Date(quote.created_at).toLocaleDateString()}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "info" && (
        <ScrollView className="flex-1 px-4">
          <Card className="mb-2">
            <InfoRow label="Phone" value={customer?.phone_number} />
            <InfoRow label="Email" value={customer?.email} />
            <InfoRow label="Address" value={customer?.address} />
            <InfoRow label="Bedrooms" value={customer?.bedrooms?.toString()} />
            <InfoRow label="Bathrooms" value={customer?.bathrooms?.toString()} />
            <InfoRow label="Sq. Footage" value={customer?.square_footage?.toString()} />
            <InfoRow label="Lead Source" value={customer?.lead_source} />
            <InfoRow label="Lifecycle" value={customer?.lifecycle_stage} />
            <InfoRow
              label="SMS Opt-Out"
              value={customer?.sms_opt_out ? "Yes" : "No"}
            />
          </Card>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between border-b border-dark-100 py-3 last:border-b-0 dark:border-dark-700">
      <Text className="text-dark-500 dark:text-dark-400">{label}</Text>
      <Text className="font-medium text-dark-900 dark:text-white">{value}</Text>
    </View>
  );
}
