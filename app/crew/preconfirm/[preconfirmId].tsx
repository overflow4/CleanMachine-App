import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchPreConfirm, respondPreConfirm } from "@/lib/crew-api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

export default function CrewPreConfirmScreen() {
  const { preconfirmId, token } = useLocalSearchParams<{ preconfirmId: string; token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["crew-preconfirm", token, preconfirmId],
    queryFn: () => fetchPreConfirm(token!, preconfirmId!),
    enabled: !!token && !!preconfirmId,
  });

  const respondMut = useMutation({
    mutationFn: (action: "confirm" | "decline") => respondPreConfirm(token!, preconfirmId!, action),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["crew-preconfirm"] });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  if (isLoading || !data) return <LoadingScreen />;

  const { preconfirm, quote, cleaner_name, business_name, brand_color } = data;
  const firstName = cleaner_name?.split(" ")[0] || "there";
  const hasResponded = preconfirm.status === "confirmed" || preconfirm.status === "declined";
  const accentColor = brand_color || Theme.primary;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: accentColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerBusiness}>{business_name}</Text>
          <Text style={s.headerSubtitle}>New Job Opportunity</Text>
        </View>
      </View>

      <View style={s.content}>
        {/* Greeting */}
        <Text style={s.greeting}>Hey {firstName}!</Text>
        <Text style={s.greetingSub}>We have a job opportunity for you.</Text>

        {/* Details */}
        {quote && (
          <GlassCard style={{ marginTop: 16 }}>
            {quote.description && <Text style={s.description}>{quote.description}</Text>}

            {/* Pay */}
            <View style={s.paySection}>
              <Text style={s.payLabel}>Your Pay</Text>
              <Text style={s.payAmount}>${preconfirm.cleaner_pay}</Text>
            </View>

            {/* Location */}
            {quote.customer_address && (
              <View style={s.detailRow}>
                <Ionicons name="location-outline" size={18} color={Theme.mutedForeground} />
                <Text style={s.detailText}>{quote.customer_address}</Text>
              </View>
            )}

            {/* Customer */}
            {quote.customer_first_name && (
              <View style={s.detailRow}>
                <Ionicons name="person-outline" size={18} color={Theme.mutedForeground} />
                <Text style={s.detailText}>{quote.customer_first_name}</Text>
              </View>
            )}

            {/* Service */}
            {quote.service_category && (
              <View style={s.detailRow}>
                <Ionicons name="construct-outline" size={18} color={Theme.mutedForeground} />
                <Text style={s.detailText}>{quote.service_category}</Text>
              </View>
            )}

            {/* Date */}
            <View style={s.detailRow}>
              <Ionicons name="calendar-outline" size={18} color={Theme.mutedForeground} />
              <Text style={s.detailText}>Client will choose date</Text>
            </View>

            {/* Property */}
            <View style={s.pillRow}>
              {quote.bedrooms > 0 && <View style={s.pill}><Text style={s.pillText}>{quote.bedrooms} bed</Text></View>}
              {quote.bathrooms > 0 && <View style={s.pill}><Text style={s.pillText}>{quote.bathrooms} bath</Text></View>}
              {quote.square_footage > 0 && <View style={s.pill}><Text style={s.pillText}>{quote.square_footage} sqft</Text></View>}
            </View>

            {quote.notes && <Text style={s.notes}>{quote.notes}</Text>}
          </GlassCard>
        )}

        {/* Responded State */}
        {hasResponded && (
          <View style={[s.respondedCard, { borderColor: preconfirm.status === "confirmed" ? "rgba(69,186,80,0.3)" : "rgba(212,9,36,0.3)", backgroundColor: preconfirm.status === "confirmed" ? "rgba(69,186,80,0.1)" : "rgba(212,9,36,0.1)" }]}>
            <Ionicons name={preconfirm.status === "confirmed" ? "checkmark-circle" : "close-circle"} size={32} color={preconfirm.status === "confirmed" ? Theme.success : Theme.destructive} />
            <Text style={[s.respondedTitle, { color: preconfirm.status === "confirmed" ? Theme.success : Theme.destructive }]}>
              {preconfirm.status === "confirmed" ? "You're In!" : "No Problem"}
            </Text>
            <Text style={s.respondedSub}>
              {preconfirm.status === "confirmed" ? "We'll send you the details when the customer books." : "We'll find someone else for this one."}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {!hasResponded && (
          <View style={s.buttons}>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: accentColor }]}
              onPress={() => respondMut.mutate("confirm")}
              disabled={respondMut.isPending}
            >
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={s.confirmBtnText}>I'm In!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.declineBtn}
              onPress={() => respondMut.mutate("decline")}
              disabled={respondMut.isPending}
            >
              <Text style={s.declineBtnText}>Not Available</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", padding: 16 },
  headerBusiness: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  content: { flex: 1, padding: 16 },
  greeting: { fontSize: 24, fontWeight: "700", color: Theme.foreground },
  greetingSub: { fontSize: 15, color: Theme.mutedForeground, marginTop: 4 },
  description: { fontSize: 14, color: Theme.foreground, marginBottom: 12 },
  paySection: { alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  payLabel: { fontSize: 12, color: Theme.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  payAmount: { fontSize: 36, fontWeight: "700", color: Theme.success, marginTop: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  detailText: { fontSize: 14, color: Theme.foreground },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: Theme.muted },
  pillText: { fontSize: 12, color: Theme.mutedForeground },
  notes: { fontSize: 13, color: Theme.mutedForeground, marginTop: 8, fontStyle: "italic" },
  respondedCard: { marginTop: 20, alignItems: "center", padding: 24, borderRadius: 12, borderWidth: 1 },
  respondedTitle: { fontSize: 22, fontWeight: "700", marginTop: 8 },
  respondedSub: { fontSize: 14, color: Theme.mutedForeground, textAlign: "center", marginTop: 8 },
  buttons: { marginTop: 24, gap: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 12 },
  confirmBtnText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  declineBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Theme.border },
  declineBtnText: { fontSize: 15, fontWeight: "500", color: Theme.mutedForeground },
});
