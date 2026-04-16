import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Theme } from "@/constants/colors";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  title?: string;
  showLegend?: boolean;
}

const CHART_COLORS = [
  Theme.primary, Theme.success, Theme.warning, Theme.violet400,
  Theme.cyan400, Theme.pink500, Theme.emerald400, Theme.amber400,
  Theme.red400, Theme.blue400,
];

export function DonutChart({
  data,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerValue,
  title,
  showLegend = true,
}: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;

  return (
    <View>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={s.row}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            {/* Background ring */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
            />
            {data.map((slice, i) => {
              const pct = slice.value / total;
              const dashLength = pct * circumference;
              const dashOffset = -cumulative * circumference;
              cumulative += pct;
              return (
                <Circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={slice.color || CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${cx}, ${cy}`}
                />
              );
            })}
          </Svg>
          {(centerLabel || centerValue) && (
            <View style={[s.center, { width: size, height: size }]}>
              {centerValue && <Text style={s.centerValue}>{centerValue}</Text>}
              {centerLabel && <Text style={s.centerLabel}>{centerLabel}</Text>}
            </View>
          )}
        </View>

        {showLegend && (
          <View style={s.legend}>
            {data.map((slice, i) => (
              <View key={i} style={s.legendItem}>
                <View style={[s.dot, { backgroundColor: slice.color || CHART_COLORS[i % CHART_COLORS.length] }]} />
                <Text style={s.legendLabel} numberOfLines={1}>{slice.label}</Text>
                <Text style={s.legendValue}>{slice.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  centerValue: { fontSize: 20, fontWeight: "700", color: Theme.foreground },
  centerLabel: { fontSize: 11, color: Theme.mutedForeground, marginTop: 2 },
  legend: { flex: 1, gap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 12, color: Theme.foreground },
  legendValue: { fontSize: 12, fontWeight: "600", color: Theme.mutedForeground },
});
