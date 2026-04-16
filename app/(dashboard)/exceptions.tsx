import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { fetchExceptionsList, fetchSystemEvents, apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ActionButton } from "@/components/ui/FormField";
import { Theme } from "@/constants/colors";
import { AttentionItem } from "@/types";

type TabKey = "exceptions" | "events";

const SOURCE_OPTIONS = [
  "all",
  "vapi",
  "openphone",
  "stripe",
  "telegram",
  "scheduler",
  "ghl",
  "cron",
  "system",
] as const;
type EventSource = (typeof SOURCE_OPTIONS)[number];

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  vapi: { bg: "rgba(167,139,250,0.15)", text: Theme.violet400 },
  openphone: { bg: Theme.infoBg, text: Theme.info },
  stripe: { bg: "rgba(236,72,153,0.15)", text: Theme.pink500 },
  telegram: { bg: Theme.infoBg, text: Theme.cyan400 },
  scheduler: { bg: Theme.warningBg, text: Theme.warning },
  ghl: { bg: Theme.successBg, text: Theme.success },
  cron: { bg: "rgba(161,161,170,0.15)", text: Theme.zinc400 },
  system: { bg: "rgba(161,161,170,0.15)", text: Theme.zinc400 },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: Theme.destructiveBg, text: Theme.destructive },
  medium: { bg: Theme.warningBg, text: Theme.warning },
  low: { bg: Theme.infoBg, text: Theme.info },
};

export default function ExceptionsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("exceptions");
  const [selectedItem, setSelectedItem] = useState<AttentionItem | null>(null);
  const [expandedExceptions, setExpandedExceptions] = useState<Set<string>>(
    new Set()
  );

  // Events tab state
  const [sourceFilter, setSourceFilter] = useState<EventSource>("all");
  const [eventSearch, setEventSearch] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(
    new Set()
  );
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Queries
  const {
    data: exceptionsData,
    isLoading: exceptionsLoading,
    refetch: refetchExceptions,
    isRefetching: exceptionsRefetching,
  } = useQuery({
    queryKey: ["exceptions"],
    queryFn: fetchExceptionsList,
  });

  const {
    data: eventsData,
    isLoading: eventsLoading,
    refetch: refetchEvents,
    isRefetching: eventsRefetching,
  } = useQuery({
    queryKey: ["system-events", sourceFilter],
    queryFn: () =>
      fetchSystemEvents(
        sourceFilter !== "all" ? { source: sourceFilter } : undefined
      ),
    enabled: activeTab === "events",
  });

  const exceptions: AttentionItem[] =
    (exceptionsData as any)?.items ?? (exceptionsData as any)?.data ?? [];
  const events: any[] =
    (eventsData as any)?.events ?? (eventsData as any)?.data ?? [];

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e: any) =>
        (e.event_type || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        (e.source || "").toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/actions/attention-needed", {
        method: "POST",
        body: JSON.stringify({ id, action: "resolve" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      setSelectedItem(null);
      Alert.alert("Success", "Exception resolved");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/actions/attention-needed", {
        method: "POST",
        body: JSON.stringify({ id, action: "dismiss" }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      setSelectedItem(null);
      Alert.alert("Success", "Exception dismissed");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleResolve = () => {
    if (!selectedItem) return;
    resolveMutation.mutate(selectedItem.id);
  };

  const handleDismiss = () => {
    if (!selectedItem) return;
    Alert.alert(
      "Dismiss Exception",
      "Are you sure you want to dismiss this exception?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          style: "destructive",
          onPress: () => dismissMutation.mutate(selectedItem.id),
        },
      ]
    );
  };

  const toggleExceptionExpanded = (id: string) => {
    setExpandedExceptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEventExpanded = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyRecentLogs = async () => {
    const recent = events.slice(0, 15);
    const text = recent
      .map(
        (e: any, i: number) =>
          `${i + 1}. [${e.source || "?"}] ${e.event_type || "event"}: ${e.description || ""} (${e.created_at || ""})`
      )
      .join("\n");
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Last 15 events copied to clipboard.");
  };

  const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    no_team_confirm: "people-outline",
    high_value: "cash-outline",
    routing_error: "navigate-outline",
    payment: "card-outline",
    message: "chatbubble-outline",
    unassigned: "person-add-outline",
    cleaner: "person-outline",
    quote: "document-text-outline",
  };

  const isLoading =
    activeTab === "exceptions" ? exceptionsLoading : eventsLoading;
  const isRefetching =
    activeTab === "exceptions" ? exceptionsRefetching : eventsRefetching;
  const handleRefetch =
    activeTab === "exceptions" ? refetchExceptions : refetchEvents;

  if (isLoading) return <LoadingScreen message="Loading..." />;

  // ===== EXCEPTIONS TAB =====
  const renderExceptionItem = ({ item }: { item: AttentionItem }) => {
    const expanded = expandedExceptions.has(item.id);
    const priority = (item.priority || "medium").toLowerCase();
    const pColors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleExceptionExpanded(item.id)}
      >
        <GlassCard style={styles.card}>
          <View style={styles.rowStart}>
            <Ionicons
              name={typeIcons[item.type] || "alert-circle-outline"}
              size={24}
              color={pColors.text}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.titleText} numberOfLines={expanded ? 0 : 1}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: pColors.bg },
                  ]}
                >
                  <Text
                    style={[styles.priorityBadgeText, { color: pColors.text }]}
                  >
                    {priority}
                  </Text>
                </View>
              </View>
              <Text
                style={styles.descText}
                numberOfLines={expanded ? 0 : 2}
              >
                {item.description}
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleString()}
              </Text>

              {/* Expanded detail */}
              {expanded && (
                <View style={styles.expandedSection}>
                  {(item as any).customer_name && (
                    <Text style={styles.expandedMeta}>
                      Customer: {(item as any).customer_name}
                    </Text>
                  )}
                  {(item as any).job_id && (
                    <Text style={styles.expandedMeta}>
                      Job: #{(item as any).job_id}
                    </Text>
                  )}
                  <View style={styles.expandedActions}>
                    <TouchableOpacity
                      style={[
                        styles.miniActionBtn,
                        { backgroundColor: Theme.successBg },
                      ]}
                      onPress={() => setSelectedItem(item)}
                    >
                      <Ionicons
                        name="open-outline"
                        size={14}
                        color={Theme.success}
                      />
                      <Text
                        style={[
                          styles.miniActionText,
                          { color: Theme.success },
                        ]}
                      >
                        Details
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.miniActionBtn,
                        { backgroundColor: Theme.primaryMuted },
                      ]}
                      onPress={() => {
                        setSelectedItem(item);
                        resolveMutation.mutate(item.id);
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={14}
                        color={Theme.primary}
                      />
                      <Text
                        style={[
                          styles.miniActionText,
                          { color: Theme.primary },
                        ]}
                      >
                        Resolve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.miniActionBtn,
                        { backgroundColor: Theme.destructiveBg },
                      ]}
                      onPress={() => {
                        setSelectedItem(item);
                        handleDismiss();
                      }}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={14}
                        color={Theme.destructive}
                      />
                      <Text
                        style={[
                          styles.miniActionText,
                          { color: Theme.destructive },
                        ]}
                      >
                        Dismiss
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  // ===== EVENTS TAB =====
  const renderEventItem = ({ item }: { item: any }) => {
    const id = item.id?.toString() || Math.random().toString();
    const expanded = expandedEvents.has(id);
    const source = (item.source || "system").toLowerCase();
    const sColors = SOURCE_COLORS[source] || SOURCE_COLORS.system;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleEventExpanded(id)}
      >
        <GlassCard style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <View style={styles.eventHeaderRow}>
                <View
                  style={[
                    styles.sourceBadge,
                    { backgroundColor: sColors.bg },
                  ]}
                >
                  <Text
                    style={[styles.sourceBadgeText, { color: sColors.text }]}
                  >
                    {source}
                  </Text>
                </View>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: Theme.glassListItem },
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {item.event_type || "event"}
                  </Text>
                </View>
              </View>
              <Text style={styles.eventDesc} numberOfLines={expanded ? 0 : 2}>
                {item.description || item.message || "No description"}
              </Text>
              <Text style={styles.dateText}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : ""}
              </Text>
            </View>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Theme.zinc500}
            />
          </View>

          {expanded && item.metadata && (
            <View style={styles.metadataSection}>
              <Text style={styles.metadataLabel}>Metadata</Text>
              <View style={styles.metadataBox}>
                <Text style={styles.metadataText}>
                  {typeof item.metadata === "string"
                    ? item.metadata
                    : JSON.stringify(item.metadata, null, 2)}
                </Text>
              </View>
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "exceptions" && styles.tabActive]}
          onPress={() => setActiveTab("exceptions")}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={
              activeTab === "exceptions"
                ? Theme.primary
                : Theme.mutedForeground
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "exceptions" && styles.tabTextActive,
            ]}
          >
            Exceptions
          </Text>
          {exceptions.length > 0 && (
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{exceptions.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "events" && styles.tabActive]}
          onPress={() => setActiveTab("events")}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              activeTab === "events" ? Theme.primary : Theme.mutedForeground
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "events" && styles.tabTextActive,
            ]}
          >
            System Events
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "exceptions" ? (
        <FlatList
          data={exceptions}
          keyExtractor={(item, i) => item.id || i.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => handleRefetch()}
              tintColor={Theme.primary}
            />
          }
          renderItem={renderExceptionItem}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title="No exceptions"
              description="All clear!"
            />
          }
        />
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item, i) => item.id?.toString() || i.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => handleRefetch()}
              tintColor={Theme.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.eventsHeader}>
              {/* Search */}
              <View style={styles.searchRow}>
                <Ionicons
                  name="search"
                  size={16}
                  color={Theme.mutedForeground}
                />
                <TextInput
                  value={eventSearch}
                  onChangeText={setEventSearch}
                  placeholder="Search events..."
                  placeholderTextColor={Theme.mutedForeground}
                  style={styles.searchInput}
                />
                {eventSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEventSearch("")}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={Theme.zinc500}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Source filter + copy button */}
              <View style={styles.eventsToolbar}>
                <TouchableOpacity
                  style={styles.sourceDropdown}
                  onPress={() => setShowSourcePicker(true)}
                >
                  <Ionicons
                    name="funnel-outline"
                    size={14}
                    color={Theme.mutedForeground}
                  />
                  <Text style={styles.sourceDropdownText}>
                    {sourceFilter === "all"
                      ? "All Sources"
                      : sourceFilter}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={Theme.mutedForeground}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyRecentLogs}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="copy-outline"
                    size={14}
                    color={Theme.primary}
                  />
                  <Text style={styles.copyBtnText}>Copy Logs</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={renderEventItem}
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="No events"
              description="System events will appear here"
            />
          }
        />
      )}

      {/* Exception Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title="Exception Details"
      >
        {selectedItem && (
          <View>
            <View style={styles.detailHeader}>
              <View
                style={[
                  styles.detailIconWrap,
                  {
                    backgroundColor:
                      selectedItem.priority === "high"
                        ? Theme.destructiveBg
                        : Theme.warningBg,
                  },
                ]}
              >
                <Ionicons
                  name={
                    typeIcons[selectedItem.type] || "alert-circle-outline"
                  }
                  size={28}
                  color={
                    selectedItem.priority === "high"
                      ? Theme.destructive
                      : Theme.warning
                  }
                />
              </View>
              <Badge
                label={selectedItem.priority}
                variant={
                  selectedItem.priority === "high" ? "error" : "warning"
                }
              />
            </View>

            <Text style={styles.detailTitle}>{selectedItem.title}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {selectedItem.type?.replace(/_/g, " ") || "Unknown"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValueFull}>
                {selectedItem.description}
              </Text>
            </View>

            {(selectedItem as any).customer_name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>
                  {(selectedItem as any).customer_name}
                </Text>
              </View>
            )}

            {(selectedItem as any).job_id && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job ID</Text>
                <Text style={styles.detailValue}>
                  #{(selectedItem as any).job_id}
                </Text>
              </View>
            )}

            {(selectedItem as any).job_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(
                    (selectedItem as any).job_date
                  ).toLocaleDateString()}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>
                {new Date(selectedItem.created_at).toLocaleString()}
              </Text>
            </View>

            {(selectedItem as any).metadata &&
              typeof (selectedItem as any).metadata === "object" && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Details</Text>
                  <Text style={styles.detailValueFull}>
                    {Object.entries((selectedItem as any).metadata)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join("\n")}
                  </Text>
                </View>
              )}

            <View style={styles.detailActions}>
              <ActionButton
                title="Resolve"
                onPress={handleResolve}
                variant="primary"
                loading={resolveMutation.isPending}
              />
              <ActionButton
                title="Dismiss"
                onPress={handleDismiss}
                variant="danger"
                loading={dismissMutation.isPending}
              />
            </View>
          </View>
        )}
      </Modal>

      {/* Source Picker Modal */}
      <Modal
        visible={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        title="Filter by Source"
      >
        {SOURCE_OPTIONS.map((src) => {
          const active = sourceFilter === src;
          const sColors =
            src === "all"
              ? { bg: Theme.glassListItem, text: Theme.foreground }
              : SOURCE_COLORS[src] || SOURCE_COLORS.system;
          return (
            <TouchableOpacity
              key={src}
              style={[
                styles.sourceOption,
                active && { borderColor: Theme.primary },
              ]}
              onPress={() => {
                setSourceFilter(src);
                setShowSourcePicker(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={active ? Theme.primary : Theme.zinc500}
              />
              <View
                style={[
                  styles.sourceOptionBadge,
                  { backgroundColor: sColors.bg },
                ]}
              >
                <Text
                  style={[
                    styles.sourceOptionBadgeText,
                    { color: sColors.text },
                  ]}
                >
                  {src === "all" ? "All Sources" : src}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.card,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Theme.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  tabTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  tabCount: {
    backgroundColor: Theme.destructive,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  card: {
    marginBottom: 8,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleText: {
    fontWeight: "500",
    color: Theme.foreground,
    flex: 1,
    marginRight: 8,
  },
  descText: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.mutedForeground,
    lineHeight: 18,
  },
  dateText: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.zinc400,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    gap: 4,
  },
  expandedMeta: {
    fontSize: 13,
    color: Theme.foreground,
  },
  expandedActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  miniActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  miniActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Events tab
  eventsHeader: {
    gap: 10,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.foreground,
  },
  eventsToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sourceDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.muted,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  sourceDropdownText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.foreground,
    textTransform: "capitalize",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.primaryMuted,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.primary,
  },
  eventHeaderRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.mutedForeground,
  },
  eventDesc: {
    fontSize: 13,
    color: Theme.foreground,
    lineHeight: 18,
  },
  metadataSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metadataBox: {
    backgroundColor: Theme.muted,
    borderRadius: 6,
    padding: 10,
  },
  metadataText: {
    fontSize: 11,
    color: Theme.zinc400,
    fontFamily: "monospace",
    lineHeight: 16,
  },
  // Detail Modal
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.foreground,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: Theme.foreground,
  },
  detailValueFull: {
    fontSize: 14,
    color: Theme.foreground,
    lineHeight: 20,
  },
  detailActions: {
    marginTop: 20,
    gap: 10,
  },
  // Source picker
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.glassListItem,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sourceOptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceOptionBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
