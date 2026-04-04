import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchLeads, fetchPipeline } from "@/lib/api";
import { Lead, LeadStatus } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

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
    <View style={styles.container}>
      {/* Pipeline Summary */}
      <View style={styles.statsRow}>
        <StatCard
          title="New Leads"
          value={pipeline.new_lead?.count ?? 0}
          icon="person-add-outline"
          iconColor={Theme.primary}
        />
        <StatCard
          title="Pipeline Value"
          value={`$${Object.values(pipeline).reduce(
            (sum: number, s: any) => sum + (s?.value ?? 0),
            0
          )}`}
          icon="cash-outline"
          iconColor={Theme.success}
        />
      </View>

      {/* Status Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={statusTabs}
        keyExtractor={(item) => item.key}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item.key)}
            style={[
              styles.filterChip,
              statusFilter === item.key ? styles.filterChipActive : styles.filterChipInactive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === item.key ? styles.filterChipTextActive : {},
              ]}
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
          <RefreshControl refreshing={leadsQuery.isRefetching} onRefresh={onRefresh} tintColor={Theme.primary} />
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.leadCard}>
            <View style={styles.rowStart}>
              <View style={styles.sourceAvatar}>
                <Ionicons
                  name={sourceIcons[item.source] || "person-outline"}
                  size={18}
                  color={Theme.warning}
                />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.nameText}>
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
                <Text style={styles.subText}>
                  {item.phone} • {item.source}
                </Text>
                {item.service_interest && (
                  <Text style={styles.subText}>
                    Interested in: {item.service_interest}
                  </Text>
                )}
                {item.estimated_value != null && (
                  <Text style={styles.valueText}>${item.estimated_value}</Text>
                )}
                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </GlassCard>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  filterList: {
    maxHeight: 48,
    paddingHorizontal: 8,
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
  leadCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.warningBg,
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.success,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
