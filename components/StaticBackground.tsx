import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Lightweight dark background with subtle gradient glow.
 * Used instead of NeuralBackground (GL canvas) on screens with
 * keyboard input to avoid iOS autofill freeze/crash.
 */
export function StaticBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      {/* Top-left glow */}
      <View style={styles.glowTopLeft}>
        <LinearGradient
          colors={["rgba(0,255,170,0.06)", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
      {/* Bottom-right glow */}
      <View style={styles.glowBottomRight}>
        <LinearGradient
          colors={["rgba(0,255,170,0.04)", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  glowTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "70%",
    height: "50%",
  },
  glowBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "60%",
    height: "40%",
  },
});
