import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { Theme } from "@/constants/colors";

interface Props extends ViewProps {
  children: React.ReactNode;
  style?: any;
  noPadding?: boolean;
}

export function GlassCard({ children, style, noPadding, ...props }: Props) {
  return (
    <View
      style={[
        styles.card,
        noPadding ? undefined : styles.padding,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.glassCard,
    borderWidth: 1,
    borderColor: Theme.glassCardBorder,
    borderRadius: 12,
    gap: 16,
  },
  padding: {
    padding: 16,
  },
});
