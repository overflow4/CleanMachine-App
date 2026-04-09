import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCrewEstimate, crewEstimateChecklistToggle, completeEstimate } from "@/lib/crew-api";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

export default function CrewEstimateScreen() {
  const { jobId, token } = useLocalSearchParams<{ jobId: string; token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({});
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crew-estimate", token, jobId],
    queryFn: () => fetchCrewEstimate(token!, jobId!),
    enabled: !!token && !!jobId,
  });

  const checklistMut = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: number; completed: boolean }) => crewEstimateChecklistToggle(token!, jobId!, itemId, completed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crew-estimate"] }),
  });

  if (isLoading || !data) return <LoadingScreen />;

  const { job, customer, pricing, tenant, checklist, availability, servicePlans } = data;
  const tiers = pricing?.tiers ?? [];
  const tierPrices = pricing?.tierPrices ?? {};
  const addons = pricing?.addons ?? [];

  const total = useMemo(() => {
    if (customPrice) return parseFloat(customPrice) || 0;
    let t = selectedTier && tierPrices[selectedTier] ? tierPrices[selectedTier].price : 0;
    for (const addon of addons) {
      if (selectedAddons[addon.key]) {
        const qty = addonQtys[addon.key] || 1;
        t += addon.price * qty;
      }
    }
    return t;
  }, [selectedTier, customPrice, selectedAddons, addonQtys, tierPrices, addons]);

  const handleSubmit = async (action: "accepted" | "send_quote") => {
    if (!selectedTier && !customPrice) { Alert.alert("Select a tier or enter a custom price"); return; }
    setSubmitting(true);
    try {
      await completeEstimate(token!, jobId!, {
        action, selected_tier: selectedTier, selected_addons: Object.keys(selectedAddons).filter(k => selectedAddons[k]),
        addon_quantities: addonQtys, custom_price: customPrice || undefined, notes, service_date: serviceDate, service_time: serviceTime,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", action === "accepted" ? "Estimate completed!" : "Quote sent to customer!", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSubmitting(false); }
  };

  const completedChecklist = checklist.filter(c => c.completed).length;
  const availDates = Object.entries(availability || {}).slice(0, 14);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Theme.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Complete Estimate</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        {/* Customer & Job Info */}
        <GlassCard>
          <Text style={s.customerName}>{customer.first_name} {customer.last_name}</Text>
          <Text style={s.meta}>{customer.phone} • {customer.address}</Text>
          <Text style={s.meta}>{job.date} {job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</Text>
        </GlassCard>

        {/* Walkthrough Checklist */}
        {checklist.length > 0 && (
          <GlassCard>
            <Text style={s.sectionTitle}>Walkthrough ({completedChecklist}/{checklist.length})</Text>
            {checklist.map(item => (
              <TouchableOpacity key={item.id} style={s.checkItem} onPress={() => checklistMut.mutate({ itemId: item.id, completed: !item.completed })}>
                <Ionicons name={item.completed ? "checkmark-circle" : "ellipse-outline"} size={22} color={item.completed ? Theme.success : Theme.mutedForeground} />
                <Text style={[s.checkText, item.completed && { textDecorationLine: "line-through", color: Theme.mutedForeground }]}>{item.text}</Text>
                {item.required && !item.completed && <Text style={s.required}>Required</Text>}
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}

        {/* Tier Selection */}
        <Text style={s.sectionTitle}>Select Tier</Text>
        {tiers.map(tier => {
          const price = tierPrices[tier.key]?.price;
          const isSelected = selectedTier === tier.key;
          return (
            <TouchableOpacity key={tier.key} onPress={() => { setSelectedTier(tier.key); setCustomPrice(""); }} activeOpacity={0.7}>
              <GlassCard style={[isSelected && { borderColor: Theme.primary }]}>
                <View style={s.tierRow}>
                  <View style={[s.radio, isSelected && s.radioSelected]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.tierName}>{tier.name}</Text>
                    <Text style={s.tierTagline}>{tier.tagline}</Text>
                    {tier.included?.map((inc, i) => (
                      <Text key={i} style={s.tierIncluded}>✓ {inc}</Text>
                    ))}
                  </View>
                  {price != null && <Text style={s.tierPrice}>${price}</Text>}
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}

        {/* Custom Price */}
        <TouchableOpacity onPress={() => { setSelectedTier(null); }} activeOpacity={0.7}>
          <GlassCard style={[!selectedTier && customPrice ? { borderColor: Theme.primary } : {}]}>
            <View style={s.tierRow}>
              <View style={[s.radio, !selectedTier && customPrice ? s.radioSelected : {}]} />
              <Text style={s.tierName}>Custom Price</Text>
              <TextInput value={customPrice} onChangeText={(v) => { setCustomPrice(v); setSelectedTier(null); }} placeholder="$0" placeholderTextColor={Theme.mutedForeground} keyboardType="decimal-pad" style={s.customInput} />
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Add-ons */}
        {addons.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Add-ons</Text>
            {addons.map(addon => (
              <TouchableOpacity key={addon.key} onPress={() => setSelectedAddons(p => ({ ...p, [addon.key]: !p[addon.key] }))} activeOpacity={0.7}>
                <GlassCard style={[selectedAddons[addon.key] && { borderColor: Theme.primary }]}>
                  <View style={s.addonRow}>
                    <Ionicons name={selectedAddons[addon.key] ? "checkbox" : "square-outline"} size={22} color={selectedAddons[addon.key] ? Theme.primary : Theme.mutedForeground} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.addonName}>{addon.name}</Text>
                      <Text style={s.meta}>{addon.description}</Text>
                    </View>
                    <Text style={s.addonPrice}>${addon.price}{addon.priceType === "per_unit" ? `/${addon.unit}` : ""}</Text>
                  </View>
                  {selectedAddons[addon.key] && addon.priceType === "per_unit" && (
                    <View style={s.qtyRow}>
                      <TouchableOpacity onPress={() => setAddonQtys(p => ({ ...p, [addon.key]: Math.max(1, (p[addon.key] || 1) - 1) }))} style={s.qtyBtn}>
                        <Ionicons name="remove" size={16} color={Theme.foreground} />
                      </TouchableOpacity>
                      <Text style={s.qtyText}>{addonQtys[addon.key] || 1}</Text>
                      <TouchableOpacity onPress={() => setAddonQtys(p => ({ ...p, [addon.key]: (p[addon.key] || 1) + 1 }))} style={s.qtyBtn}>
                        <Ionicons name="add" size={16} color={Theme.foreground} />
                      </TouchableOpacity>
                    </View>
                  )}
                </GlassCard>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Service Date */}
        <GlassCard>
          <Text style={s.sectionTitle}>Service Date</Text>
          {availDates.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {availDates.map(([d, count]) => (
                <TouchableOpacity key={d} onPress={() => setServiceDate(d)} style={[s.dateChip, serviceDate === d && s.dateChipActive]}>
                  <Text style={[s.dateChipText, serviceDate === d && { color: "#fff" }]}>
                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                  <View style={[s.availDot, { backgroundColor: (count as number) < 3 ? Theme.success : (count as number) < 5 ? "#f59e0b" : Theme.destructive }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput value={serviceTime} onChangeText={setServiceTime} placeholder="Time (e.g. 9:00 AM)" placeholderTextColor={Theme.mutedForeground} style={s.input} />
        </GlassCard>

        {/* Notes */}
        <GlassCard>
          <Text style={s.sectionTitle}>Notes</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Additional notes..." placeholderTextColor={Theme.mutedForeground} multiline style={[s.input, { minHeight: 60 }]} />
        </GlassCard>
      </ScrollView>

      {/* Sticky Bottom */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.totalPrice}>${total.toFixed(2)}</Text>
        <View style={s.bottomBtns}>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: Theme.primary, flex: 1 }]} onPress={() => handleSubmit("accepted")} disabled={submitting}>
            <Text style={s.submitBtnText}>{submitting ? "..." : "Book Now"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: Theme.muted, flex: 1, borderWidth: 1, borderColor: Theme.border }]} onPress={() => handleSubmit("send_quote")} disabled={submitting}>
            <Text style={[s.submitBtnText, { color: Theme.foreground }]}>Send Quote</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.background },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: Theme.border },
  headerTitle: { fontSize: 17, fontWeight: "600", color: Theme.foreground },
  customerName: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  meta: { fontSize: 13, color: Theme.mutedForeground, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Theme.foreground, marginBottom: 4 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkText: { fontSize: 14, color: Theme.foreground, flex: 1 },
  required: { fontSize: 10, color: Theme.destructive, fontWeight: "600" },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Theme.border },
  radioSelected: { borderColor: Theme.primary, backgroundColor: Theme.primary },
  tierName: { fontSize: 15, fontWeight: "600", color: Theme.foreground },
  tierTagline: { fontSize: 12, color: Theme.mutedForeground },
  tierIncluded: { fontSize: 12, color: Theme.success, marginTop: 2 },
  tierPrice: { fontSize: 18, fontWeight: "700", color: Theme.violet300 },
  customInput: { width: 80, textAlign: "right", fontSize: 18, fontWeight: "700", color: Theme.foreground, borderBottomWidth: 1, borderBottomColor: Theme.border, paddingVertical: 4 },
  addonRow: { flexDirection: "row", alignItems: "center" },
  addonName: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  addonPrice: { fontSize: 14, fontWeight: "600", color: Theme.violet300 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Theme.muted, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 16, fontWeight: "600", color: Theme.foreground },
  dateChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Theme.muted, marginRight: 8, alignItems: "center" },
  dateChipActive: { backgroundColor: Theme.primary },
  dateChipText: { fontSize: 12, fontWeight: "500", color: Theme.foreground },
  availDot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
  input: { borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 10, color: Theme.foreground, fontSize: 14 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.card },
  totalLabel: { fontSize: 12, color: Theme.mutedForeground },
  totalPrice: { fontSize: 28, fontWeight: "700", color: Theme.success },
  bottomBtns: { flexDirection: "row", gap: 10, marginTop: 10 },
  submitBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
