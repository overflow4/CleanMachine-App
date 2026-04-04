import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/colors";

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}

export function EmptyState({ icon = "document-text-outline", title, description }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={Theme.zinc600} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.desc}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { marginTop: 16, fontSize: 17, fontWeight: "600", color: Theme.foreground },
  desc: { marginTop: 8, textAlign: "center", color: Theme.mutedForeground, fontSize: 14 },
});
