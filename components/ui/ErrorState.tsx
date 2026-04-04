import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/colors";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={Theme.destructive} />
      <Text style={styles.title}>Error</Text>
      <Text style={styles.desc}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.btn}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { marginTop: 16, fontSize: 17, fontWeight: "600", color: Theme.foreground },
  desc: { marginTop: 8, textAlign: "center", color: Theme.mutedForeground, fontSize: 14 },
  btn: { marginTop: 16, borderRadius: 8, backgroundColor: Theme.primary, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
