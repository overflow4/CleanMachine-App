import React from "react";
import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Search..." }: Props) {
  return (
    <View className="mx-4 mb-3 flex-row items-center rounded-lg bg-dark-100 px-3 dark:bg-dark-800">
      <Ionicons name="search" size={18} color="#94a3b8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        className="ml-2 flex-1 py-2.5 text-base text-dark-900 dark:text-white"
      />
    </View>
  );
}
