import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/colors";

export interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  stages: FunnelStage[];
  title?: string;
  showDropoff?: boolean;
  formatValue?: (v: number) => string;
}

const FUNNEL_COLORS = [
  Theme.primary, "#2563eb", Theme.violet400, Theme.warning, Theme.success, Theme.emerald400,
];

export function FunnelChart({
  stages,
  title,
  showDropoff = true,
  formatValue = (v) => String(v),
}: Props) {
  if (!stages.length) return null;
  const maxVal = Math.max(...stages.map((s) => s.value), 1);

  return (
    <View>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={s.container}>
        {stages.map((stage, i) => {
          const pct = (stage.value / maxVal) * 100;
          const prevVal = i > 0 ? stages[i - 1].value : stage.value;
          const dropoff = prevVal > 0 ? Math.round(((prevVal - stage.value) / prevVal) * 100) : 0;
          const color = stage.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length];

          return (
            <View key={i} style={s.row}>
              <View style={s.labelCol}>
                <Text style={s.stageLabel} numberOfLines={1}>{stage.label}</Text>
                <Text style={s.stageValue}>{formatValue(stage.value)}</Text>
              </View>
              <View style={s.barCol}>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
                </View>
                {showDropoff && i > 0 && dropoff > 0 && (
                  <Text style={s.dropoff}>-{dropoff}%</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  container: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  labelCol: { width: 80 },
  stageLabel: { fontSize: 11, color: Theme.mutedForeground },
  stageValue: { fontSize: 14, fontWeight: "600", color: Theme.foreground },
  barCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  barBg: {
    flex: 1, height: 24, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 6 },
  dropoff: { fontSize: 10, color: Theme.destructive, fontWeight: "600", width: 36, textAlign: "right" },
});
