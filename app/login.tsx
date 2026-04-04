import React, { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      router.replace("/(tabs)/overview");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-dark-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-8 py-12">
          <View className="mb-10 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-500">
              <Text className="text-3xl font-bold text-white">O</Text>
            </View>
            <Text className="text-3xl font-bold text-white">Osiris</Text>
            <Text className="mt-2 text-dark-400">
              Sign in to your account
            </Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg bg-red-500/10 p-3">
              <Text className="text-center text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Username, email, or phone"
            autoCapitalize="none"
            autoCorrect={false}
            containerClassName="mb-4"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            containerClassName="mb-6"
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
