import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";

interface Props {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ title, value, icon, iconColor = "#3b82f6", trend }: Props) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <View className="flex-row items-center justify-between">
        <View className="rounded-lg bg-primary-50 p-2 dark:bg-primary-900/20">
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        {trend && (
          <Text
            className={`text-xs font-medium ${
              trend.value >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </Text>
        )}
      </View>
      <Text className="mt-3 text-2xl font-bold text-dark-900 dark:text-white">
        {value}
      </Text>
      <Text className="mt-0.5 text-sm text-dark-500 dark:text-dark-400">
        {title}
      </Text>
    </Card>
  );
}
