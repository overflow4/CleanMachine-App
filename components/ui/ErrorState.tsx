import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: Props) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
      <Text className="mt-4 text-lg font-semibold text-dark-700 dark:text-dark-200">
        Error
      </Text>
      <Text className="mt-2 text-center text-dark-500 dark:text-dark-400">
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="mt-4 rounded-lg bg-primary-500 px-6 py-3"
        >
          <Text className="font-semibold text-white">Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
