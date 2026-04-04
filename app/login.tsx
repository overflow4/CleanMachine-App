import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
  Linking,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { NeuralBackground } from "@/components/NeuralBackground";
import { DotLoader } from "@/components/DotLoader";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Blinking cursor animation
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.replace("/(dashboard)/overview");
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Try again.");
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <View style={styles.container}>
        <NeuralBackground color="#00ffaa" particleCount={200} speed={0.8} />
        <View style={styles.centerContent}>
          <View style={styles.cardWrapper}>
            <View style={[styles.card, { borderColor: "rgba(16,185,129,0.2)", backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <View style={styles.successContent}>
                {/* Checkmark circle */}
                <View style={styles.checkCircle}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 13l4 4L19 7"
                      stroke="#34D399"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.monoText, styles.successTitle]}>
                  ACCESS GRANTED
                </Text>
                <Text style={[styles.monoText, styles.successSubtitle]}>
                  Welcome back, {username}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NeuralBackground color="#00ffaa" particleCount={200} speed={0.8} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.centerContent}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardWrapper}>
            {/* Glow effect behind card */}
            <View style={styles.glowContainer}>
              <LinearGradient
                colors={[
                  "rgba(16,185,129,0.2)",
                  "rgba(6,182,212,0.2)",
                  "rgba(16,185,129,0.2)",
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.glowGradient}
              />
            </View>

            {/* Main card */}
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.monoText, styles.title]}>
                  <Text style={styles.emeraldText}>{">"}</Text>
                  _CLEAN MACHINE
                  <Animated.Text
                    style={[styles.emeraldText, { opacity: cursorOpacity }]}
                  >
                    _
                  </Animated.Text>
                </Text>
                <Text style={[styles.monoText, styles.subtitle]}>
                  SECURE DASHBOARD ACCESS
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Username field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.monoText, styles.label]}>
                    <Text style={styles.emeraldText}>//</Text> EMAIL, PHONE, OR
                    USERNAME
                  </Text>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="email, phone, or username"
                    placeholderTextColor="#525252"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    editable={!loading}
                    style={[styles.monoText, styles.input]}
                  />
                </View>

                {/* Password field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.monoText, styles.label]}>
                    <Text style={styles.emeraldText}>//</Text> PASSWORD
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#525252"
                    secureTextEntry
                    autoComplete="current-password"
                    editable={!loading}
                    style={[styles.monoText, styles.input]}
                  />
                </View>

                {/* Error message */}
                {error ? (
                  <View style={styles.errorSection}>
                    <View style={styles.errorBox}>
                      <Text style={[styles.monoText, styles.errorText]}>
                        <Text style={styles.errorPrefix}>[ERROR]</Text> {error}
                      </Text>
                    </View>
                    {/* Employee help hint */}
                    <View style={styles.hintBox}>
                      <Text style={styles.hintText}>
                        <Text style={styles.hintBold}>Employee?</Text> Your
                        default username is your full name (e.g. "Bob Jones").
                        Your password is a 4-digit PIN — ask your manager if you
                        don't have it.
                      </Text>
                      <Text style={[styles.hintText, styles.hintSpanish]}>
                        <Text style={styles.hintBold}>Empleado?</Text> Tu
                        nombre de usuario predeterminado es tu nombre completo
                        (ej. "Bob Jones"). Tu contraseña es un PIN de 4 dígitos
                        — pregúntale a tu gerente si no lo tienes.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Submit button */}
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                  style={[
                    styles.button,
                    loading && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <View style={styles.buttonLoadingContent}>
                      <DotLoader duration={50} scale={0.75} />
                      <Text
                        style={[
                          styles.monoText,
                          { color: "#A3A3A3", fontSize: 14, fontWeight: "600", letterSpacing: 1.6 },
                        ]}
                      >
                        AUTHENTICATING...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.monoText, styles.buttonText]}>
                      {"[  INITIALIZE  ]"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer link */}
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://osiris-code.vercel.app/")
            }
            style={styles.footer}
          >
            <Text style={[styles.monoText, styles.footerLink]}>
              New to Osiris? Book a call to sign up!
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
  },
  // Glow effect
  glowContainer: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    overflow: "hidden",
    opacity: 0.75,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 16,
    // Simulating blur with shadow since RN doesn't support CSS blur on views
  },
  // Main card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 32,
  },
  // Header
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1.5,
    color: "#F5F5F5",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 1.6,
    color: "#737373",
    textTransform: "uppercase",
  },
  emeraldText: {
    color: "#34D399",
  },
  // Form
  form: {
    gap: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.8,
    color: "#A3A3A3",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#404040",
    backgroundColor: "rgba(23,23,23,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#F5F5F5",
  },
  // Error
  errorSection: {
    gap: 8,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    backgroundColor: "rgba(239,68,68,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#F87171",
  },
  errorPrefix: {
    color: "#EF4444",
    fontWeight: "700",
  },
  hintBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    backgroundColor: "rgba(245,158,11,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hintText: {
    fontSize: 12,
    color: "rgba(252,211,77,0.9)",
    lineHeight: 19.5,
  },
  hintSpanish: {
    marginTop: 6,
    color: "rgba(252,211,77,0.7)",
  },
  hintBold: {
    fontWeight: "600",
  },
  // Button
  button: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#34D399",
    textTransform: "uppercase",
  },
  buttonLoadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  // Footer
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
  footerLink: {
    fontSize: 12,
    color: "#C084FC",
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
  // Success state
  successContent: {
    alignItems: "center",
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: "#34D399",
  },
  successSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#A3A3A3",
  },
  // Mono text base
  monoText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
