import React from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchCalls } from "@/lib/api";
import { CallRecord } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

export default function CallsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["calls"],
    queryFn: fetchCalls,
  });

  const calls: CallRecord[] = (data as any)?.data ?? (data as any)?.calls ?? [];

  if (isLoading) return <LoadingScreen message="Loading calls..." />;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <FlatList
      style={styles.container}
      data={calls}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
      renderItem={({ item }) => (
        <GlassCard style={styles.card}>
          <View style={styles.rowStart}>
            <View style={[
              styles.directionIcon,
              { backgroundColor: item.direction === "inbound" ? Theme.successBg : Theme.infoBg },
            ]}>
              <Ionicons
                name={item.direction === "inbound" ? "call-outline" : "arrow-redo-outline"}
                size={20}
                color={item.direction === "inbound" ? Theme.success : Theme.info}
              />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.nameText}>
                {item.customer_name || item.phone_number}
              </Text>
              <Text style={styles.subText}>
                {item.direction} {"\u2022"} {formatDuration(item.duration_seconds)}
              </Text>
              {item.outcome && (
                <Badge
                  label={item.outcome}
                  variant={item.outcome === "booked" ? "success" : item.outcome === "no_answer" ? "error" : "default"}
                />
              )}
              {item.transcript && (
                <Text style={styles.transcriptText} numberOfLines={3}>
                  {item.transcript}
                </Text>
              )}
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {item.recording_url && (
              <TouchableOpacity onPress={() => Linking.openURL(item.recording_url!)}>
                <Ionicons name="play-circle-outline" size={28} color={Theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>
      )}
      ListEmptyComponent={
        <EmptyState icon="call-outline" title="No calls" description="Call logs will appear here" />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background,
  },
  card: {
    marginBottom: 8,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  directionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  transcriptText: {
    marginTop: 8,
    fontSize: 13,
    color: Theme.foreground,
    opacity: 0.7,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
});
