import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/colors";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Search..." }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={16} color={Theme.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme.mutedForeground}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, borderRadius: 10, backgroundColor: Theme.muted,
    borderWidth: 1, borderColor: Theme.border,
  },
  input: { flex: 1, marginLeft: 8, paddingVertical: 10, fontSize: 14, color: Theme.foreground },
});
