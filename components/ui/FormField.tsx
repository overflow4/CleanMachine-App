import React from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet, Switch } from "react-native";
import { Theme } from "@/constants/colors";

interface InputFieldProps extends TextInputProps {
  label: string;
}

export function InputField({ label, ...props }: InputFieldProps) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={Theme.mutedForeground} {...props} />
    </View>
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function ToggleField({ label, description, value, onValueChange }: ToggleFieldProps) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {description && <Text style={s.toggleDesc}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: Theme.border, true: "rgba(0,145,255,0.3)" }} thumbColor={value ? Theme.primary : Theme.mutedForeground} />
    </View>
  );
}

export function ActionButton({ title, onPress, variant = "primary", loading, disabled }: {
  title: string; onPress: () => void; variant?: "primary" | "danger" | "outline"; loading?: boolean; disabled?: boolean;
}) {
  const bg = variant === "primary" ? Theme.primary : variant === "danger" ? Theme.destructive : "transparent";
  const textColor = variant === "outline" ? Theme.foreground : "#fff";
  const borderColor = variant === "outline" ? Theme.border : bg;
  return (
    <View style={[s.actionBtn, { backgroundColor: bg, borderColor, opacity: disabled || loading ? 0.5 : 1 }]}>
      <Text style={[s.actionBtnText, { color: textColor }]} onPress={disabled || loading ? undefined : onPress}>
        {loading ? "Loading..." : title}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "500", color: Theme.mutedForeground, marginBottom: 6 },
  input: { borderRadius: 8, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.muted, paddingHorizontal: 12, paddingVertical: 11, color: Theme.foreground, fontSize: 15 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  toggleLabel: { fontSize: 14, fontWeight: "500", color: Theme.foreground },
  toggleDesc: { fontSize: 12, color: Theme.mutedForeground, marginTop: 2 },
  actionBtn: { borderRadius: 8, paddingVertical: 13, alignItems: "center", borderWidth: 1 },
  actionBtnText: { fontSize: 15, fontWeight: "600" },
});
