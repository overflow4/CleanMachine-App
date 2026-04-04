import React from "react";
import { View, Text } from "react-native";

type Variant = "default" | "success" | "warning" | "error" | "info";

const variantClasses: Record<Variant, string> = {
  default: "bg-dark-200 dark:bg-dark-600",
  success: "bg-green-100 dark:bg-green-900",
  warning: "bg-yellow-100 dark:bg-yellow-900",
  error: "bg-red-100 dark:bg-red-900",
  info: "bg-blue-100 dark:bg-blue-900",
};

const textClasses: Record<Variant, string> = {
  default: "text-dark-700 dark:text-dark-200",
  success: "text-green-700 dark:text-green-200",
  warning: "text-yellow-700 dark:text-yellow-200",
  error: "text-red-700 dark:text-red-200",
  info: "text-blue-700 dark:text-blue-200",
};

interface Props {
  label: string;
  variant?: Variant;
}

export function Badge({ label, variant = "default" }: Props) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${variantClasses[variant]}`}>
      <Text className={`text-xs font-medium ${textClasses[variant]}`}>{label}</Text>
    </View>
  );
}
