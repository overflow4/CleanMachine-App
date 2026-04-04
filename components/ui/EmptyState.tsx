import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}

export function EmptyState({ icon = "document-text-outline", title, description }: Props) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Ionicons name={icon} size={48} color="#94a3b8" />
      <Text className="mt-4 text-lg font-semibold text-dark-700 dark:text-dark-200">
        {title}
      </Text>
      {description && (
        <Text className="mt-2 text-center text-dark-500 dark:text-dark-400">
          {description}
        </Text>
      )}
    </View>
  );
}
