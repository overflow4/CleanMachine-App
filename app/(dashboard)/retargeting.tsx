import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchRetargetingCustomers, fetchRetargetingPipeline, fetchRetargetingAbResults } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

type Tab = "customers" | "pipeline" | "ab_results";

export default function RetargetingScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("customers");

  const customersQuery = useQuery({
    queryKey: ["retargeting-customers"],
    queryFn: fetchRetargetingCustomers,
    enabled: activeTab === "customers",
  });

  const pipelineQuery = useQuery({
    queryKey: ["retargeting-pipeline"],
    queryFn: fetchRetargetingPipeline,
    enabled: activeTab === "pipeline",
  });

  const abQuery = useQuery({
    queryKey: ["retargeting-ab"],
    queryFn: fetchRetargetingAbResults,
    enabled: activeTab === "ab_results",
  });

  const customers: any[] = (customersQuery.data as any)?.data ?? (customersQuery.data as any)?.customers ?? [];
  const pipeline: any = pipelineQuery.data ?? {};
  const abResults: any[] = (abQuery.data as any)?.data ?? (abQuery.data as any)?.results ?? [];

  const isLoading =
    (activeTab === "customers" && customersQuery.isLoading) ||
    (activeTab === "pipeline" && pipelineQuery.isLoading) ||
    (activeTab === "ab_results" && abQuery.isLoading);

  const onRefresh = async () => {
    if (activeTab === "customers") await customersQuery.refetch();
    else if (activeTab === "pipeline") await pipelineQuery.refetch();
    else await abQuery.refetch();
  };

  if (isLoading) return <LoadingScreen message="Loading retargeting..." />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "customers", label: "Customers" },
    { key: "pipeline", label: "Pipeline" },
    { key: "ab_results", label: "A/B Results" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Theme.primary} />}
      >
        {activeTab === "customers" &&
          (customers.length === 0 ? (
            <EmptyState icon="refresh-outline" title="No retargeting customers" />
          ) : (
            customers.map((c, i) => (
              <GlassCard key={i} style={styles.card}>
                <Text style={styles.nameText}>
                  {c.first_name || c.name || c.phone_number || "Customer"}
                </Text>
                <Text style={styles.subText}>
                  {c.phone_number || ""} {"\u2022"} Last service: {c.last_service_date || "N/A"}
                </Text>
              </GlassCard>
            ))
          ))}

        {activeTab === "pipeline" && (
          <View>
            {Object.entries(pipeline).map(([stage, data]: [string, any]) =>
              data && typeof data === "object" ? (
                <GlassCard key={stage} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.stageText}>
                      {stage.replace(/_/g, " ")}
                    </Text>
                    <Badge label={`${data.count ?? 0}`} variant="info" />
                  </View>
                </GlassCard>
              ) : null
            )}
          </View>
        )}

        {activeTab === "ab_results" &&
          (abResults.length === 0 ? (
            <EmptyState icon="flask-outline" title="No A/B test results" />
          ) : (
            abResults.map((result, i) => (
              <GlassCard key={i} style={styles.card}>
                <Text style={styles.nameText}>
                  {result.name || `Test ${i + 1}`}
                </Text>
                <Text style={styles.subText}>
                  {result.description || ""}
                </Text>
                <View style={styles.variantRow}>
                  <Text style={styles.variantText}>
                    Variant A: {result.variant_a_rate ?? "N/A"}%
                  </Text>
                  <Text style={styles.variantText}>
                    Variant B: {result.variant_b_rate ?? "N/A"}%
                  </Text>
                </View>
              </GlassCard>
            ))
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: Theme.card,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 8,
  },
  nameText: {
    fontWeight: "500",
    color: Theme.foreground,
  },
  subText: {
    fontSize: 13,
    color: Theme.mutedForeground,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageText: {
    fontWeight: "500",
    textTransform: "capitalize",
    color: Theme.foreground,
  },
  variantRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  variantText: {
    fontSize: 13,
    color: Theme.zinc400,
  },
});
