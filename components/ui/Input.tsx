import React from "react";
import { View, TextInput, Text, TextInputProps } from "react-native";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({ label, error, containerClassName = "", ...props }: Props) {
  return (
    <View className={containerClassName}>
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-dark-700 dark:text-dark-300">
          {label}
        </Text>
      )}
      <TextInput
        className={`rounded-lg border px-4 py-3 text-base text-dark-900 dark:text-white ${
          error
            ? "border-red-400 dark:border-red-500"
            : "border-dark-300 dark:border-dark-600"
        } bg-white dark:bg-dark-800`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
      {error && (
        <Text className="mt-1 text-sm text-red-500">{error}</Text>
      )}
    </View>
  );
}
