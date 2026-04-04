import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/colors";

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Theme.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Theme.background },
  message: { marginTop: 16, color: Theme.mutedForeground, fontSize: 14 },
});
