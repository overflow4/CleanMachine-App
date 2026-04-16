import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from "react-native-svg";
import { Theme } from "@/constants/colors";

export interface AreaChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface Props {
  data: AreaChartPoint[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  showLabels?: boolean;
  showValues?: boolean;
  formatValue?: (v: number) => string;
  title?: string;
  stacked?: boolean;
}

export function AreaChart({
  data,
  height = 160,
  color = Theme.primary,
  secondaryColor = Theme.violet400,
  showLabels = true,
  showValues = false,
  formatValue = (v) => String(v),
  title,
  stacked = false,
}: Props) {
  if (!data.length) return null;

  const padX = 16;
  const padTop = 10;
  const padBot = showLabels ? 28 : 10;
  const chartW = Math.max(data.length * 40, 300);
  const chartH = height - padTop - padBot;
  const maxVal = Math.max(
    ...data.map((d) => (stacked ? d.value + (d.secondaryValue ?? 0) : Math.max(d.value, d.secondaryValue ?? 0))),
    1
  );

  const xStep = (chartW - padX * 2) / Math.max(data.length - 1, 1);

  function buildPath(values: number[], baseline?: number[]): string {
    const points = values.map((v, i) => {
      const x = padX + i * xStep;
      const base = baseline ? baseline[i] : 0;
      const y = padTop + chartH - ((v + base) / maxVal) * chartH;
      return { x, y };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cpx = (points[i - 1].x + points[i].x) / 2;
      d += ` C ${cpx} ${points[i - 1].y}, ${cpx} ${points[i].y}, ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  function buildFillPath(values: number[], baseline?: number[]): string {
    const line = buildPath(values, baseline);
    const lastX = padX + (data.length - 1) * xStep;
    const firstX = padX;
    const bottom = padTop + chartH;

    if (baseline) {
      const basePoints = baseline.map((v, i) => {
        const x = padX + i * xStep;
        const y = padTop + chartH - (v / maxVal) * chartH;
        return `${x} ${y}`;
      }).reverse();
      return `${line} L ${basePoints.join(" L ")} Z`;
    }
    return `${line} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`;
  }

  const primaryValues = data.map((d) => d.value);
  const secondaryValues = data.map((d) => d.secondaryValue ?? 0);
  const hasSecondary = secondaryValues.some((v) => v > 0);

  return (
    <View>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={{ height, overflow: "hidden" }}>
        <Svg width={chartW} height={height} viewBox={`0 0 ${chartW} ${height}`}>
          <Defs>
            <LinearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
            <LinearGradient id="gradSecondary" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={secondaryColor} stopOpacity={0.3} />
              <Stop offset="1" stopColor={secondaryColor} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padTop + chartH * (1 - frac);
            return (
              <Line key={frac} x1={padX} y1={y} x2={chartW - padX} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            );
          })}

          {/* Secondary area (if stacked, below primary) */}
          {hasSecondary && (
            <>
              <Path d={buildFillPath(secondaryValues)} fill="url(#gradSecondary)" />
              <Path d={buildPath(secondaryValues)} fill="none" stroke={secondaryColor}
                strokeWidth={2} opacity={0.7} />
            </>
          )}

          {/* Primary area */}
          <Path
            d={buildFillPath(primaryValues, stacked && hasSecondary ? secondaryValues : undefined)}
            fill="url(#gradPrimary)"
          />
          <Path
            d={buildPath(primaryValues, stacked && hasSecondary ? secondaryValues : undefined)}
            fill="none" stroke={color} strokeWidth={2}
          />

          {/* X-axis labels */}
          {showLabels && data.map((item, i) => {
            if (data.length > 15 && i % Math.ceil(data.length / 8) !== 0) return null;
            return (
              <SvgText key={i} x={padX + i * xStep} y={height - 4}
                textAnchor="middle" fontSize={9} fill={Theme.zinc400}>
                {item.label.slice(0, 5)}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "600", color: Theme.foreground, marginBottom: 8 },
});
