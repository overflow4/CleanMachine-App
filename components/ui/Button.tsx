import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from "react-native";
import * as Haptics from "expo-haptics";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary-500 active:bg-primary-600",
  secondary: "bg-dark-200 dark:bg-dark-700 active:bg-dark-300",
  outline: "border border-dark-300 dark:border-dark-600 active:bg-dark-100 dark:active:bg-dark-800",
  danger: "bg-red-500 active:bg-red-600",
  ghost: "active:bg-dark-100 dark:active:bg-dark-800",
};

const textClassMap: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-dark-800 dark:text-dark-100",
  outline: "text-dark-800 dark:text-dark-100",
  danger: "text-white",
  ghost: "text-dark-700 dark:text-dark-300",
};

interface Props extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  haptic?: boolean;
}

const sizeClasses = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3.5",
};

const textSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  size = "md",
  haptic = true,
  onPress,
  disabled,
  ...props
}: Props) {
  const handlePress = (e: any) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      className={`items-center justify-center rounded-lg ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? "opacity-50" : ""}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#fff" : "#64748b"}
        />
      ) : (
        <Text className={`font-semibold ${textClassMap[variant]} ${textSizes[size]}`}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
