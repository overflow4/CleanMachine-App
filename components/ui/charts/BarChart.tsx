import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { Theme } from "@/constants/colors";

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
  secondaryColor?: string;
}

interface Props {
  data: BarChartItem[];
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  formatValue?: (v: number) => string;
  barColor?: string;
  title?: string;
}

export function BarChart({
  data,
  height = 180,
  showValues = true,
  showLabels = true,
  formatValue = (v) => String(v),
  barColor = Theme.primary,
  title,
}: Props) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.value + (d.secondaryValue ?? 0)), 1);
  const barWidth = Math.max(12, Math.min(40, (300 - data.length * 4) / data.length));
  const chartWidth = data.length * (barWidth + 8) + 32;
  const chartHeight = height - (showLabels ? 28 : 0);
  const barAreaHeight = chartHeight - 20;

  return (
    <View>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={{ height, overflow: "hidden" }}>
        <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = 10 + barAreaHeight * (1 - frac);
            return (
              <Line
                key={frac}
                x1={16}
                y1={y}
                x2={chartWidth - 16}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}

          {data.map((item, i) => {
            const x = 20 + i * (barWidth + 8);
            const color = item.color || barColor;
            const barH = (item.value / maxVal) * barAreaHeight;
            const secH = item.secondaryValue ? (item.secondaryValue / maxVal) * barAreaHeight : 0;
            const totalH = barH + secH;

            return (
              <React.Fragment key={i}>
                {/* Secondary (stacked) bar */}
                {secH > 0 && (
                  <Rect
                    x={x}
                    y={10 + barAreaHeight - totalH}
                    width={barWidth}
                    height={secH}
                    rx={4}
                    fill={item.secondaryColor || Theme.violet400}
                    opacity={0.7}
                  />
                )}
                {/* Primary bar */}
                <Rect
                  x={x}
                  y={10 + barAreaHeight - barH}
                  width={barWidth}
                  height={Math.max(barH, 1)}
                  rx={4}
                  fill={color}
                  opacity={0.85}
                />
                {/* Value label */}
                {showValues && item.value > 0 && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={10 + barAreaHeight - totalH - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={Theme.mutedForeground}
                  >
                    {formatValue(item.value)}
                  </SvgText>
                )}
                {/* X-axis label */}
                {showLabels && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={height - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={Theme.zinc400}
                  >
                    {item.label.slice(0, 5)}
                  </SvgText>
                )}
              </React.Fragment>
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
