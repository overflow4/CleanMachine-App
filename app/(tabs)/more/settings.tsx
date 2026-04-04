import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fetchSettings, updateSettings } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { TenantSettings } from "@/types";

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const settings: TenantSettings = (data as any)?.settings ?? {};

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEdits({});
      Alert.alert("Success", "Settings saved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  if (isLoading) return <LoadingScreen message="Loading settings..." />;

  const fields = Object.entries(settings).filter(
    ([_, v]) => typeof v === "string" || typeof v === "number"
  );

  return (
    <ScrollView
      className="flex-1 bg-dark-50 dark:bg-dark-900"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <View className="p-4">
        <Card>
          {fields.map(([key, value]) => (
            <View key={key} className="mb-3">
              <Text className="mb-1 text-sm font-medium text-dark-500 dark:text-dark-400 capitalize">
                {key.replace(/_/g, " ")}
              </Text>
              <TextInput
                defaultValue={String(value ?? "")}
                onChangeText={(v) => setEdits((prev) => ({ ...prev, [key]: v }))}
                className="rounded-lg border border-dark-300 bg-white px-3 py-2.5 text-dark-900 dark:border-dark-600 dark:bg-dark-800 dark:text-white"
                placeholderTextColor="#94a3b8"
              />
            </View>
          ))}
          {Object.keys(edits).length > 0 && (
            <Button
              title="Save Changes"
              onPress={() => saveMutation.mutate(edits)}
              loading={saveMutation.isPending}
            />
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
