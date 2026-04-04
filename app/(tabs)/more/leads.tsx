import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchLeads, fetchPipeline } from "@/lib/api";
import { Lead, LeadStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

const statusTabs: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "booked", label: "Booked" },
  { key: "nurturing", label: "Nurturing" },
  { key: "lost", label: "Lost" },
];

const sourceIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  phone: "call-outline",
  sms: "chatbubble-outline",
  meta: "logo-facebook",
  website: "globe-outline",
  google: "logo-google",
  google_lsa: "logo-google",
  thumbtack: "pin-outline",
  manual: "pencil-outline",
  email: "mail-outline",
  vapi: "call-outline",
};

export default function LeadsScreen() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");

  const leadsQuery = useQuery({
    queryKey: ["leads", statusFilter],
    queryFn: () => fetchLeads(statusFilter === "all" ? undefined : statusFilter),
  });

  const pipelineQuery = useQuery({
    queryKey: ["pipeline"],
    queryFn: fetchPipeline,
  });

  const leads: Lead[] = (leadsQuery.data as any)?.data ?? [];
  const pipeline: any = (pipelineQuery.data as any)?.stages ?? {};

  const filteredLeads = search
    ? leads.filter(
        (l) =>
          l.name?.toLowerCase().includes(search.toLowerCase()) ||
          l.phone?.includes(search)
      )
    : leads;

  const onRefresh = useCallback(async () => {
    await Promise.all([leadsQuery.refetch(), pipelineQuery.refetch()]);
  }, []);

  if (leadsQuery.isLoading && !leads.length) {
    return <LoadingScreen message="Loading leads..." />;
  }

  return (
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      {/* Pipeline Summary */}
      <View className="flex-row gap-2 px-4 pt-2 pb-2">
        <StatCard
          title="New Leads"
          value={pipeline.new_lead?.count ?? 0}
          icon="person-add-outline"
          iconColor="#3b82f6"
        />
        <StatCard
          title="Pipeline Value"
          value={`$${Object.values(pipeline).reduce(
            (sum: number, s: any) => sum + (s?.value ?? 0),
            0
          )}`}
          icon="cash-outline"
          iconColor="#22c55e"
        />
      </View>

      {/* Status Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={statusTabs}
        keyExtractor={(item) => item.key}
        className="max-h-12 px-2"
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item.key)}
            className={`mx-1 rounded-full px-4 py-2 ${
              statusFilter === item.key
                ? "bg-primary-500"
                : "bg-dark-200 dark:bg-dark-700"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                statusFilter === item.key
                  ? "text-white"
                  : "text-dark-700 dark:text-dark-300"
              }`}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search leads..." />

      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={leadsQuery.isRefetching} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <Card className="mx-4 mb-2">
            <View className="flex-row items-start">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Ionicons
                  name={sourceIcons[item.source] || "person-outline"}
                  size={18}
                  color="#f59e0b"
                />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-dark-900 dark:text-white">
                    {item.name || item.phone}
                  </Text>
                  <Badge
                    label={item.status}
                    variant={
                      item.status === "booked"
                        ? "success"
                        : item.status === "lost"
                        ? "error"
                        : item.status === "new"
                        ? "info"
                        : "default"
                    }
                  />
                </View>
                <Text className="text-sm text-dark-500 dark:text-dark-400">
                  {item.phone} • {item.source}
                </Text>
                {item.service_interest && (
                  <Text className="text-sm text-dark-500 dark:text-dark-400">
                    Interested in: {item.service_interest}
                  </Text>
                )}
                {item.estimated_value != null && (
                  <Text className="text-sm font-medium text-green-600 dark:text-green-400">
                    ${item.estimated_value}
                  </Text>
                )}
                <Text className="mt-1 text-xs text-dark-400">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="trending-up-outline"
            title="No leads found"
            description="Leads will appear here as they come in"
          />
        }
      />
    </View>
  );
}
