import React, { useState, useMemo, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchNewQuotePricing, submitNewQuote } from "@/lib/crew-api";
import { GlassCard } from "@/components/ui/GlassCard";
import { InputField } from "@/components/ui/FormField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Theme } from "@/constants/colors";

export default function CrewNewQuoteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [sqft, setSqft] = useState("");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({});
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Re-fetch pricing when sqft changes (debounced)
  const [sqftQuery, setSqftQuery] = useState<number | undefined>();
  useEffect(() => {
    const t = setTimeout(() => {
      const n = parseInt(sqft);
      if (n > 0) setSqftQuery(n);
    }, 500);
    return () => clearTimeout(t);
  }, [sqft]);

  const { data, isLoading } = useQuery({
    queryKey: ["crew-new-quote", token, sqftQuery],
    queryFn: () => fetchNewQuotePricing(token!, sqftQuery),
    enabled: !!token,
  });

  if (isLoading && !data) return <LoadingScreen />;

  const tiers = data?.pricing?.tiers ?? [];
  const tierPrices = data?.pricing?.tierPrices ?? {};
  const addons = data?.pricing?.addons ?? [];
  const availability = data?.availability ?? {};
  const availDates = Object.entries(availability).slice(0, 14);

  const total = useMemo(() => {
    if (customPrice) return parseFloat(customPrice) || 0;
    let t = selectedTier && tierPrices[selectedTier] ? tierPrices[selectedTier].price : 0;
    for (const addon of addons) {
      if (selectedAddons[addon.key]) t += addon.price * (addonQtys[addon.key] || 1);
    }
    return t;
  }, [selectedTier, customPrice, selectedAddons, addonQtys, tierPrices, addons]);

  const handleSubmit = async (action: "accepted" | "send_quote") => {
    if (!phone.trim()) { Alert.alert("Phone number required"); return; }
    if (!address.trim()) { Alert.alert("Address required"); return; }
    if (!selectedTier && !customPrice) { Alert.alert("Select a tier or enter a custom price"); return; }
    if (action === "accepted" && !serviceDate) { Alert.alert("Select a service date to book"); return; }

    setSubmitting(true);
    try {
      await submitNewQuote(token!, {
        action, first_name: firstName, last_name: lastName, phone, email, address, sqft: sqft || undefined,
        selected_tier: selectedTier, selected_addons: Object.keys(selectedAddons).filter(k => selectedAddons[k]),
        addon_quantities: addonQtys, custom_price: customPrice || undefined, notes, service_date: serviceDate, service_time: serviceTime,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", action === "accepted" ? "Job booked!" : "Quote sent!", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSubmitting(false); }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Theme.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Quote</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
        {/* Customer Info */}
        <GlassCard>
          <Text style={s.sectionTitle}>Customer Info</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><InputField label="First Name" value={firstName} onChangeText={setFirstName} /></View>
            <View style={{ flex: 1 }}><InputField label="Last Name" value={lastName} onChangeText={setLastName} /></View>
          </View>
          <InputField label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <InputField label="Address *" value={address} onChangeText={setAddress} />
          <InputField label="Sq. Footage" value={sqft} onChangeText={setSqft} keyboardType="numeric" />
        </GlassCard>

        {/* Tier Selection */}
        {tiers.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Select Tier</Text>
            {tiers.map(tier => {
              const price = tierPrices[tier.key]?.price;
              const isSel = selectedTier === tier.key;
              return (
                <TouchableOpacity key={tier.key} onPress={() => { setSelectedTier(tier.key); setCustomPrice(""); }}>
                  <GlassCard style={[isSel && { borderColor: Theme.primary }]}>
                    <View style={s.tierRow}>
                      <View style={[s.radio, isSel && s.radioSel]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.tierName}>{tier.name}</Text>
                        {tier.included?.map((inc, i) => <Text key={i} style={s.tierInc}>✓ {inc}</Text>)}
                      </View>
                      {price != null && <Text style={s.tierPrice}>${price}</Text>}
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setSelectedTier(null)}>
              <GlassCard style={[!selectedTier && customPrice ? { borderColor: Theme.primary } : {}]}>
                <View style={s.tierRow}>
                  <View style={[s.radio, !selectedTier && customPrice ? s.radioSel : {}]} />
                  <Text style={s.tierName}>Custom Price</Text>
                  <TextInput value={customPrice} onChangeText={v => { setCustomPrice(v); setSelectedTier(null); }} placeholder="$0" placeholderTextColor={Theme.mutedForeground} keyboardType="decimal-pad" style={s.customInput} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </>
        )}

        {/* Add-ons */}
        {addons.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Add-ons</Text>
            {addons.map(addon => (
              <TouchableOpacity key={addon.key} onPress={() => setSelectedAddons(p => ({ ...p, [addon.key]: !p[addon.key] }))}>
                <GlassCard style={[selectedAddons[addon.key] && { borderColor: Theme.primary }]}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name={selectedAddons[addon.key] ? "checkbox" : "square-outline"} size={22} color={selectedAddons[addon.key] ? Theme.primary : Theme.mutedForeground} />
                    <Text style={[s.tierName, { marginLeft: 10, flex: 1 }]}>{addon.name}</Text>
                    <Text style={s.tierPrice}>${addon.price}</Text>
                  </View>
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <InputField label="Time" value={serviceTime} onChangeText={setServiceTime} placeholder="e.g. 9:00 AM" />
        </GlassCard>

        {/* Notes */}
        <GlassCard>
          <InputField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Additional notes..." />
        </GlassCard>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 8 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontSize: 12, color: Theme.mutedForeground }}>Total</Text>
          <Text style={{ fontSize: 28, fontWeight: "700", color: Theme.success }}>${total.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <TouchableOpacity style={[s.btn, { backgroundColor: Theme.primary, flex: 1 }]} onPress={() => handleSubmit("accepted")} disabled={submitting}>
            <Text style={s.btnText}>{submitting ? "..." : "Book Now"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: Theme.muted, flex: 1, borderWidth: 1, borderColor: Theme.border }]} onPress={() => handleSubmit("send_quote")} disabled={submitting}>
            <Text style={[s.btnText, { color: Theme.foreground }]}>Send Quote</Text>
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
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Theme.foreground, marginBottom: 4 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Theme.border },
  radioSel: { borderColor: Theme.primary, backgroundColor: Theme.primary },
  tierName: { fontSize: 15, fontWeight: "600", color: Theme.foreground },
  tierInc: { fontSize: 12, color: Theme.success, marginTop: 2 },
  tierPrice: { fontSize: 18, fontWeight: "700", color: Theme.violet300 },
  customInput: { width: 80, textAlign: "right", fontSize: 18, fontWeight: "700", color: Theme.foreground, borderBottomWidth: 1, borderBottomColor: Theme.border },
  dateChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Theme.muted, marginRight: 8 },
  dateChipActive: { backgroundColor: Theme.primary },
  dateChipText: { fontSize: 12, fontWeight: "500", color: Theme.foreground },
  bottom: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.card },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
