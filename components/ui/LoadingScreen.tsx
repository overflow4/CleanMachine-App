import React from "react";
import { View, ActivityIndicator, Text } from "react-native";

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-dark-900">
      <ActivityIndicator size="large" color="#3b82f6" />
      {message && (
        <Text className="mt-4 text-dark-500 dark:text-dark-400">{message}</Text>
      )}
    </View>
  );
}
