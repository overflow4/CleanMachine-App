import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchCustomers, createCustomer } from "@/lib/api";
import { Customer } from "@/types";
import { SearchBar } from "@/components/ui/SearchBar";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { InputField, ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";

const emptyForm = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  address: "",
  notes: "",
};

export default function CustomersScreen() {
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers(search || undefined),
  });

  // Debug: log what we actually got back
  const raw = data as any;
  const customers: Customer[] = raw?.data?.customers ?? raw?.data ?? raw?.customers ?? [];
  if (__DEV__ && data) {
    console.log("[Customers] data keys:", Object.keys(raw || {}), "count:", customers.length);
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowCreateModal(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => {
      Alert.alert("Failed to create customer", err.message);
    },
  });

  const handleCreate = () => {
    if (!form.first_name.trim() && !form.phone_number.trim()) {
      Alert.alert("Required", "Please enter at least a first name or phone number.");
      return;
    }
    createMutation.mutate(form);
  };

  const updateField = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
  if (isError) {
    return (
      <View style={s.container}>
        <View style={{ padding: 24, alignItems: "center" }}>
          <Ionicons name="alert-circle-outline" size={40} color={Theme.destructive} />
          <Text style={{ color: Theme.foreground, fontSize: 16, fontWeight: "600", marginTop: 12 }}>Failed to load customers</Text>
          <Text style={{ color: Theme.mutedForeground, fontSize: 13, marginTop: 4, textAlign: "center" }}>{(error as Error)?.message || "Unknown error"}</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 16, backgroundColor: Theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

      {/* Floating Action Button */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.8}
        onPress={() => {
          setForm(emptyForm);
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Customer Modal */}
      <Modal visible={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Customer">
        <InputField label="First Name" value={form.first_name} onChangeText={updateField("first_name")} />
        <InputField label="Last Name" value={form.last_name} onChangeText={updateField("last_name")} />
        <InputField label="Phone Number" value={form.phone_number} onChangeText={updateField("phone_number")} />
        <InputField label="Email" value={form.email} onChangeText={updateField("email")} />
        <InputField label="Address" value={form.address} onChangeText={updateField("address")} />
        <InputField label="Notes" value={form.notes} onChangeText={updateField("notes")} />
        <View style={{ marginTop: 12 }}>
          <ActionButton title="Create Customer" onPress={handleCreate} variant="primary" loading={createMutation.isPending} />
        </View>
      </Modal>
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
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
