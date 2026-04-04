import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fetchSettings, updateSettings } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";
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
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
    >
      <View style={styles.content}>
        <GlassCard>
          {fields.map(([key, value]) => (
            <View key={key} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {key.replace(/_/g, " ")}
              </Text>
              <TextInput
                defaultValue={String(value ?? "")}
                onChangeText={(v) => setEdits((prev) => ({ ...prev, [key]: v }))}
                style={styles.input}
                placeholderTextColor={Theme.mutedForeground}
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
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  content: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.mutedForeground,
    textTransform: "capitalize",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.foreground,
    fontSize: 15,
  },
});
