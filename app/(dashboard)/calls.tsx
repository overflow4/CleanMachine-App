import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Linking,
  TextInput,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fetchCalls } from "@/lib/api";
import { CallRecord } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Theme } from "@/constants/colors";

export default function CallsScreen() {
  const [phoneFilter, setPhoneFilter] = useState("");
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["calls"],
    queryFn: () => fetchCalls(),
  });

  const allCalls: CallRecord[] = (data as any)?.data ?? (data as any)?.calls ?? [];

  const filteredCalls = useMemo(() => {
    if (!phoneFilter.trim()) return allCalls;
    const q = phoneFilter.toLowerCase().replace(/\D/g, "");
    return allCalls.filter(
      (c) =>
        c.phone_number?.replace(/\D/g, "").includes(q) ||
        c.customer_name?.toLowerCase().includes(phoneFilter.toLowerCase())
    );
  }, [allCalls, phoneFilter]);

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <LoadingScreen message="Loading calls..." />;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isBusinessHours = (iso: string) => {
    const d = new Date(iso);
    const hour = d.getHours();
    const day = d.getDay();
    return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
  };

  return (
    <View style={st.container}>
      {/* Filter bar */}
      <View style={st.filterBar}>
        <View style={st.searchRow}>
          <Ionicons name="search" size={16} color={Theme.mutedForeground} />
          <TextInput
            style={st.searchInput}
            placeholder="Filter by phone or name..."
            placeholderTextColor={Theme.mutedForeground}
            value={phoneFilter}
            onChangeText={setPhoneFilter}
            returnKeyType="search"
          />
          {phoneFilter.length > 0 && (
            <TouchableOpacity onPress={() => setPhoneFilter("")}>
              <Ionicons name="close-circle" size={16} color={Theme.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => refetch()} style={st.refreshBtn}>
          <Ionicons name="refresh" size={18} color={Theme.mutedForeground} />
          <Text style={st.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Results count */}
      {phoneFilter.trim().length > 0 && (
        <Text style={st.resultCount}>{filteredCalls.length} result{filteredCalls.length !== 1 ? "s" : ""}</Text>
      )}

      <FlatList
        data={filteredCalls}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Theme.primary} />}
        renderItem={({ item }) => {
          const isInbound = item.direction === "inbound";
          const callId = String(item.id);
          const isExpanded = expandedTranscripts.has(callId);
          const afterHours = item.created_at && !isBusinessHours(item.created_at);
          const dur = (item as any).duration_seconds ?? (item as any).duration ?? 0;

          return (
            <GlassCard>
              <View style={st.rowStart}>
                <View style={[st.directionIcon, { backgroundColor: isInbound ? Theme.successBg : Theme.infoBg }]}>
                  <Ionicons
                    name={isInbound ? "call-outline" : "arrow-redo-outline"}
                    size={20}
                    color={isInbound ? Theme.success : Theme.info}
                  />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={st.nameText}>{item.customer_name || item.phone_number}</Text>
                  <Text style={st.subText}>
                    {item.direction} {"\u2022"} {formatDuration(dur)}
                  </Text>

                  {/* Badge row */}
                  <View style={st.badgeRow}>
                    {/* Call type badge */}
                    <View style={[st.badge, { backgroundColor: isInbound ? Theme.successBg : Theme.infoBg }]}>
                      <Text style={[st.badgeText, { color: isInbound ? Theme.success : Theme.info }]}>
                        {isInbound ? "inbound" : "outbound"}
                      </Text>
                    </View>

                    {/* Outcome badge */}
                    {item.outcome && (
                      <View style={[st.badge, { backgroundColor: outcomeBg(item.outcome) }]}>
                        <Text style={[st.badgeText, { color: outcomeColor(item.outcome) }]}>
                          {item.outcome}
                        </Text>
                      </View>
                    )}

                    {/* Handler badge */}
                    {(item as any).handler && (
                      <View style={[st.badge, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
                        <Text style={[st.badgeText, { color: Theme.violet400 }]}>
                          {(item as any).handler}
                        </Text>
                      </View>
                    )}

                    {/* After-hours badge */}
                    {afterHours && (
                      <View style={[st.badge, { backgroundColor: Theme.destructiveBg }]}>
                        <Text style={[st.badgeText, { color: Theme.destructive }]}>after-hours</Text>
                      </View>
                    )}
                  </View>

                  {/* Transcript */}
                  {item.transcript && (
                    <>
                      <Text style={st.transcriptPreview} numberOfLines={isExpanded ? undefined : 2}>
                        {item.transcript}
                      </Text>
                      <TouchableOpacity onPress={() => toggleTranscript(callId)} style={st.transcriptToggle}>
                        <Text style={st.transcriptToggleText}>
                          {isExpanded ? "Hide transcript" : "Show full transcript"}
                        </Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color={Theme.mutedForeground} />
                      </TouchableOpacity>
                    </>
                  )}

                  <Text style={st.dateText}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </Text>
                </View>

                {item.recording_url && (
                  <TouchableOpacity onPress={() => Linking.openURL(item.recording_url!)} style={{ padding: 4 }}>
                    <Ionicons name="play-circle-outline" size={28} color={Theme.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="call-outline"
            title={phoneFilter ? "No matching calls" : "No calls"}
            description={phoneFilter ? "Try a different search" : "Call logs will appear here"}
          />
        }
      />
    </View>
  );
}

const outcomeBg = (o: string) => {
  switch (o) {
    case "booked": case "completed": case "answered": return Theme.successBg;
    case "no_answer": case "voicemail": return Theme.warningBg;
    case "cancelled": case "failed": return Theme.destructiveBg;
    default: return "rgba(113,113,122,0.1)";
  }
};

const outcomeColor = (o: string) => {
  switch (o) {
    case "booked": case "completed": case "answered": return Theme.success;
    case "no_answer": case "voicemail": return Theme.warning;
    case "cancelled": case "failed": return Theme.destructive;
    default: return Theme.zinc400;
  }
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  filterBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.card,
  },
  searchRow: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 14, color: Theme.foreground, height: 38 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  refreshText: { fontSize: 12, color: Theme.mutedForeground },
  resultCount: { fontSize: 12, color: Theme.mutedForeground, paddingHorizontal: 16, paddingTop: 8 },
  rowStart: { flexDirection: "row", alignItems: "flex-start" },
  directionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  nameText: { fontWeight: "500", color: Theme.foreground },
  subText: { fontSize: 13, color: Theme.mutedForeground, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  transcriptPreview: { marginTop: 8, fontSize: 13, color: Theme.foreground, opacity: 0.7, lineHeight: 18 },
  transcriptToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  transcriptToggleText: { fontSize: 11, color: Theme.mutedForeground },
  dateText: { marginTop: 6, fontSize: 11, color: Theme.zinc400 },
});
