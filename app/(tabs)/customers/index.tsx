import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchCustomers } from "@/lib/api";
import { Customer } from "@/types";
import { SearchBar } from "@/components/ui/SearchBar";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

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
      return (
        <TouchableOpacity
          onPress={() => router.push(`/(tabs)/customers/${item.id}`)}
          className="mx-4 mb-2 rounded-xl bg-white p-4 dark:bg-dark-800"
        >
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
              <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
                {(item.first_name?.[0] || item.phone_number?.[0] || "?").toUpperCase()}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-medium text-dark-900 dark:text-white">
                {name}
              </Text>
              <Text className="text-sm text-dark-500 dark:text-dark-400">
                {item.phone_number}
              </Text>
            </View>
            {item.lifecycle_stage && (
              <Badge
                label={item.lifecycle_stage}
                variant={
                  item.lifecycle_stage === "customer"
                    ? "success"
                    : item.lifecycle_stage === "lead"
                    ? "info"
                    : "default"
                }
              />
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#94a3b8"
              style={{ marginLeft: 8 }}
            />
          </View>
          {item.email && (
            <Text className="ml-13 mt-1 text-xs text-dark-400 dark:text-dark-500">
              {item.email}
            </Text>
          )}
          {item.address && (
            <Text className="ml-13 text-xs text-dark-400 dark:text-dark-500" numberOfLines={1}>
              {item.address}
            </Text>
          )}
        </TouchableOpacity>
      );
    },
    [router]
  );

  if (isLoading && !customers.length) {
    return <LoadingScreen message="Loading customers..." />;
  }

  return (
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search customers..."
      />
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id ?? item.phone_number}
        renderItem={renderCustomer}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No customers found"
            description={search ? "Try a different search term" : "Customers will appear here"}
          />
        }
      />
    </View>
  );
}
