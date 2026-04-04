import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchCustomers } from "@/lib/api";
import { Customer } from "@/types";
import { SearchBar } from "@/components/ui/SearchBar";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

export default function CustomersScreen() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers(search || undefined),
  });

  const customers: Customer[] = (data as any)?.data ?? (data as any) ?? [];

  const renderCustomer = useCallback(
    ({ item }: { item: Customer }) => {
      const name = [item.first_name, item.last_name].filter(Boolean).join(" ") || item.phone_number;
      const stage = item.lifecycle_stage;
      const stageBg = stage === "customer" ? Theme.successBg : stage === "lead" ? Theme.infoBg : "rgba(113,113,122,0.1)";
      const stageColor = stage === "customer" ? Theme.success : stage === "lead" ? Theme.info : Theme.zinc400;
      return (
        <TouchableOpacity
          onPress={() => router.push(`/(dashboard)/customers/${item.id}`)}
          style={s.customerItem}
          activeOpacity={0.7}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(item.first_name?.[0] || item.phone_number?.[0] || "?").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.phone}>{item.phone_number}</Text>
            {item.email && <Text style={s.meta}>{item.email}</Text>}
          </View>
          {stage && (
            <View style={[s.badge, { backgroundColor: stageBg }]}>
              <Text style={[s.badgeText, { color: stageColor }]}>{stage}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Theme.zinc600} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      );
    },
    [router]
  );

  if (isLoading && !customers.length) return <LoadingScreen message="Loading customers..." />;

  return (
    <View style={s.container}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search customers..." />
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id ?? item.phone_number}
        renderItem={renderCustomer}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 6 }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No customers found" description={search ? "Try a different search" : "Customers will appear here"} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  customerItem: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12,
    backgroundColor: Theme.glassListItem, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.primaryMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "600", color: Theme.primaryLight },
  name: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  phone: { fontSize: 12, color: Theme.mutedForeground, marginTop: 1 },
  meta: { fontSize: 11, color: Theme.zinc600, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
});
