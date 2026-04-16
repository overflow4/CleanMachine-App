import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/colors";

interface Props {
  title: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: number; // percentage change, positive or negative
  trendLabel?: string;
  subtitle?: string;
  compact?: boolean;
}

export function MetricCard({
  title,
  value,
  icon,
  iconColor = Theme.primary,
  trend,
  trendLabel,
  subtitle,
  compact,
}: Props) {
  return (
    <View style={[s.card, compact && s.cardCompact]}>
      <View style={s.headerRow}>
        {icon && (
          <View style={[s.iconBox, { backgroundColor: iconColor + "18" }]}>
            <Ionicons name={icon} size={compact ? 14 : 16} color={iconColor} />
          </View>
        )}
        {trend !== undefined && (
          <View style={[s.trendBadge, { backgroundColor: trend >= 0 ? Theme.successBg : Theme.destructiveBg }]}>
            <Ionicons
              name={trend >= 0 ? "arrow-up" : "arrow-down"}
              size={10}
              color={trend >= 0 ? Theme.success : Theme.destructive}
            />
            <Text style={[s.trendText, { color: trend >= 0 ? Theme.success : Theme.destructive }]}>
              {Math.abs(trend).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={[s.value, compact && s.valueCompact]}>{value}</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {trendLabel && <Text style={s.trendLabel}>{trendLabel}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Theme.glassCard,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
    borderRadius: 12,
    padding: 14,
    minWidth: 130,
  },
  cardCompact: { padding: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  iconBox: { padding: 6, borderRadius: 8 },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 11, fontWeight: "600" },
  value: { fontSize: 22, fontWeight: "700", color: Theme.foreground },
  valueCompact: { fontSize: 18 },
  title: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  subtitle: { fontSize: 11, color: Theme.zinc400, marginTop: 2 },
  trendLabel: { fontSize: 10, color: Theme.zinc500, marginTop: 4 },
});
