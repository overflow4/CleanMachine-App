import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Theme } from "@/constants/colors";

interface Props {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  value?: string;
}

export function ProgressRing({
  progress,
  size = 100,
  strokeWidth = 10,
  color = Theme.primary,
  label,
  value,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 100) / 100);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90} origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={[s.center, { width: size, height: size }]}>
        {value && <Text style={s.value}>{value}</Text>}
        {label && <Text style={s.label}>{label}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  value: { fontSize: 18, fontWeight: "700", color: Theme.foreground },
  label: { fontSize: 10, color: Theme.mutedForeground, marginTop: 2 },
});
