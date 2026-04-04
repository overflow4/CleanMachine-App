import React from "react";
import { View, ViewProps } from "react-native";

interface Props extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: Props) {
  return (
    <View
      className={`rounded-xl bg-white p-4 shadow-sm dark:bg-dark-800 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
