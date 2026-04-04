import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchRetargetingCustomers, fetchRetargetingPipeline, fetchRetargetingAbResults } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";

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
    <View className="flex-1 bg-dark-50 dark:bg-dark-900">
      <View className="mx-4 mt-2 mb-3 flex-row rounded-lg bg-dark-100 p-1 dark:bg-dark-800">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 items-center rounded-md py-2.5 ${
              activeTab === tab.key ? "bg-white dark:bg-dark-700" : ""
            }`}
          >
            <Text className={`text-sm font-medium ${
              activeTab === tab.key ? "text-primary-500" : "text-dark-500 dark:text-dark-400"
            }`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {activeTab === "customers" &&
          (customers.length === 0 ? (
            <EmptyState icon="refresh-outline" title="No retargeting customers" />
          ) : (
            customers.map((c, i) => (
              <Card key={i} className="mb-2">
                <Text className="font-medium text-dark-900 dark:text-white">
                  {c.first_name || c.name || c.phone_number || "Customer"}
                </Text>
                <Text className="text-sm text-dark-500 dark:text-dark-400">
                  {c.phone_number || ""} • Last service: {c.last_service_date || "N/A"}
                </Text>
              </Card>
            ))
          ))}

        {activeTab === "pipeline" && (
          <View>
            {Object.entries(pipeline).map(([stage, data]: [string, any]) =>
              data && typeof data === "object" ? (
                <Card key={stage} className="mb-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-medium capitalize text-dark-900 dark:text-white">
                      {stage.replace(/_/g, " ")}
                    </Text>
                    <Badge label={`${data.count ?? 0}`} variant="info" />
                  </View>
                </Card>
              ) : null
            )}
          </View>
        )}

        {activeTab === "ab_results" &&
          (abResults.length === 0 ? (
            <EmptyState icon="flask-outline" title="No A/B test results" />
          ) : (
            abResults.map((result, i) => (
              <Card key={i} className="mb-2">
                <Text className="font-medium text-dark-900 dark:text-white">
                  {result.name || `Test ${i + 1}`}
                </Text>
                <Text className="text-sm text-dark-500 dark:text-dark-400">
                  {result.description || ""}
                </Text>
                <View className="mt-2 flex-row justify-between">
                  <Text className="text-sm text-dark-400">
                    Variant A: {result.variant_a_rate ?? "N/A"}%
                  </Text>
                  <Text className="text-sm text-dark-400">
                    Variant B: {result.variant_b_rate ?? "N/A"}%
                  </Text>
                </View>
              </Card>
            ))
          ))}
      </ScrollView>
    </View>
  );
}
