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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { NeuralBackground } from "@/components/NeuralBackground";
import { DotLoader } from "@/components/DotLoader";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { API_URL } from "@/constants/config";

type Mode = "select" | "crew" | "staff";

export default function AppEntryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  const [mode, setMode] = useState<Mode>("select");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [crewResult, setCrewResult] = useState<{
    name: string;
    employee_type: string;
    portalUrl: string;
  } | null>(null);
  const [staffSuccess, setStaffSuccess] = useState(false);

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

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(dashboard)/overview");
    }
  }, [isLoading, isAuthenticated]);

  // Format phone as user types: (xxx) xxx-xxxx
  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) setPhone(digits);
    else if (digits.length <= 6)
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
    else
      setPhone(
        `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      );
  }

  async function handleCrewLogin() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/crew-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setCrewResult({
        name: data.cleaner.name,
        employee_type: data.cleaner.employee_type,
        portalUrl: data.portalUrl,
      });
      setLoading(false);

      // For crew members, open their portal URL in the browser
      setTimeout(() => {
        if (data.portalUrl) {
          Linking.openURL(`${API_URL}${data.portalUrl}`);
        }
      }, 1200);
    } catch {
      setError("Connection error. Try again.");
      setLoading(false);
    }
  }

  async function handleStaffLogin() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      await login(username.trim(), password.trim());
      setStaffSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.replace("/(dashboard)/overview");
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Try again.");
      setLoading(false);
    }
  }

  // Still checking auth
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingCenter}>
          <Animated.Text
            style={[styles.monoText, styles.emeraldText, { fontSize: 14 }]}
          >
            LOADING...
          </Animated.Text>
        </View>
      </View>
    );
  }

  // Already authenticated — will redirect
  if (isAuthenticated) return null;

  // Crew success screen
  if (crewResult) {
    const roleLabel =
      crewResult.employee_type === "salesman" ? "Sales" : "Crew";
    return (
      <View style={styles.container}>
        <NeuralBackground color="#00ffaa" particleCount={200} speed={0.8} />
        <View style={styles.centerContent}>
          <View style={[styles.cardWrapper, { maxWidth: 368 }]}>
            <View
              style={[
                styles.card,
                {
                  borderColor: "rgba(16,185,129,0.2)",
                  backgroundColor: "rgba(0,0,0,0.6)",
                },
              ]}
            >
              <View style={styles.successContent}>
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
                  Welcome back
                </Text>
                <Text style={styles.crewName}>{crewResult.name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                </View>
                <Text style={styles.portalLoading}>
                  Loading your portal...
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Staff success screen
  if (staffSuccess) {
    return (
      <View style={styles.container}>
        <NeuralBackground color="#00ffaa" particleCount={200} speed={0.8} />
        <View style={styles.centerContent}>
          <View style={[styles.cardWrapper, { maxWidth: 368 }]}>
            <View
              style={[
                styles.card,
                {
                  borderColor: "rgba(16,185,129,0.2)",
                  backgroundColor: "rgba(0,0,0,0.6)",
                },
              ]}
            >
              <View style={styles.successContent}>
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
          <View style={[styles.cardWrapper, { maxWidth: 368 }]}>
            {/* Logo / Header */}
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
              {mode === "select" && (
                <Text style={[styles.monoText, styles.subtitle]}>
                  SELECT YOUR ROLE
                </Text>
              )}
            </View>

            {/* ===== ROLE SELECTION ===== */}
            {mode === "select" && (
              <View style={styles.roleButtons}>
                {/* Technician / Cleaner */}
                <TouchableOpacity
                  onPress={() => {
                    setMode("crew");
                    setError("");
                  }}
                  activeOpacity={0.85}
                  style={styles.roleButton}
                >
                  <View style={[styles.roleIcon, { backgroundColor: "rgba(59,130,246,0.2)" }]}>
                    <Svg
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        stroke="#60A5FA"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View>
                    <Text style={styles.roleTitle}>Technician / Cleaner</Text>
                  </View>
                </TouchableOpacity>

                {/* Salesman */}
                <TouchableOpacity
                  onPress={() => {
                    setMode("crew");
                    setError("");
                  }}
                  activeOpacity={0.85}
                  style={styles.roleButton}
                >
                  <View style={[styles.roleIcon, { backgroundColor: "rgba(168,85,247,0.2)" }]}>
                    <Svg
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        stroke="#C084FC"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View>
                    <Text style={styles.roleTitle}>Salesman</Text>
                  </View>
                </TouchableOpacity>

                {/* Operator / Owner */}
                <TouchableOpacity
                  onPress={() => {
                    setMode("staff");
                    setError("");
                  }}
                  activeOpacity={0.85}
                  style={styles.roleButton}
                >
                  <View style={[styles.roleIcon, { backgroundColor: "rgba(16,185,129,0.2)" }]}>
                    <Svg
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        stroke="#34D399"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View>
                    <Text style={styles.roleTitle}>Operator / Owner</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== CREW LOGIN (Phone) ===== */}
            {mode === "crew" && (
              <View>
                <View style={styles.glowContainer}>
                  <LinearGradient
                    colors={[
                      "rgba(59,130,246,0.2)",
                      "rgba(6,182,212,0.2)",
                      "rgba(59,130,246,0.2)",
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.glowGradient}
                  />
                </View>
                <View style={[styles.card, { padding: 24 }]}>
                  {/* Back button */}
                  <TouchableOpacity
                    onPress={() => {
                      setMode("select");
                      setError("");
                    }}
                    style={styles.backButton}
                  >
                    <Svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M15 19l-7-7 7-7"
                        stroke="#737373"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.backText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.formTitle}>Crew Sign In</Text>
                  <Text style={styles.formSubtitle}>
                    Enter the phone number your company has on file
                  </Text>

                  {/* Phone field */}
                  <View style={{ marginTop: 24, gap: 16 }}>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.monoText, styles.label]}>
                        PHONE NUMBER
                      </Text>
                      <TextInput
                        value={phone}
                        onChangeText={handlePhoneChange}
                        placeholder="(555) 123-4567"
                        placeholderTextColor="#525252"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        autoFocus
                        editable={!loading}
                        style={[styles.input, { fontSize: 18 }]}
                      />
                    </View>

                    {error ? (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      onPress={handleCrewLogin}
                      disabled={
                        loading || phone.replace(/\D/g, "").length < 10
                      }
                      activeOpacity={0.8}
                      style={[
                        styles.crewButton,
                        (loading || phone.replace(/\D/g, "").length < 10) &&
                          styles.buttonDisabledOpacity,
                      ]}
                    >
                      <Text style={styles.crewButtonText}>
                        {loading ? "Signing in..." : "Sign In"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ===== STAFF LOGIN (Username/Password) ===== */}
            {mode === "staff" && (
              <View>
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
                <View style={[styles.card, { padding: 24 }]}>
                  {/* Back button */}
                  <TouchableOpacity
                    onPress={() => {
                      setMode("select");
                      setError("");
                    }}
                    style={styles.backButton}
                  >
                    <Svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <Path
                        d="M15 19l-7-7 7-7"
                        stroke="#737373"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.backText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.formTitle}>Staff Sign In</Text>
                  <Text style={styles.formSubtitle}>
                    Dashboard access for operators and owners
                  </Text>

                  <View style={{ marginTop: 24, gap: 16 }}>
                    {/* Username */}
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.monoText, styles.label]}>
                        USERNAME
                      </Text>
                      <TextInput
                        value={username}
                        onChangeText={setUsername}
                        placeholder="enter_username"
                        placeholderTextColor="#525252"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        autoFocus
                        editable={!loading}
                        style={[styles.monoText, styles.input]}
                      />
                    </View>

                    {/* Password */}
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.monoText, styles.label]}>
                        PASSWORD
                      </Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="--------"
                        placeholderTextColor="#525252"
                        secureTextEntry
                        autoComplete="current-password"
                        editable={!loading}
                        style={[styles.monoText, styles.input]}
                      />
                    </View>

                    {/* Error */}
                    {error ? (
                      <View style={styles.errorBox}>
                        <Text style={[styles.monoText, styles.errorText]}>
                          <Text style={styles.errorPrefix}>[ERROR]</Text>{" "}
                          {error}
                        </Text>
                      </View>
                    ) : null}

                    {/* Submit */}
                    <TouchableOpacity
                      onPress={handleStaffLogin}
                      disabled={loading}
                      activeOpacity={0.8}
                      style={[
                        styles.staffButton,
                        loading && styles.buttonDisabledOpacity,
                      ]}
                    >
                      {loading ? (
                        <View style={styles.buttonLoadingContent}>
                          <DotLoader duration={50} scale={0.75} />
                          <Text
                            style={[
                              styles.monoText,
                              {
                                color: "#A3A3A3",
                                fontSize: 14,
                                fontWeight: "600",
                                letterSpacing: 1.6,
                              },
                            ]}
                          >
                            AUTHENTICATING...
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.monoText, styles.staffButtonText]}>
                          {"[ INITIALIZE ]"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
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
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    alignSelf: "center",
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

  // Role selection buttons
  roleButtons: {
    gap: 12,
  },
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#404040",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
  },

  // Glow
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
  },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 32,
  },

  // Back button
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  backText: {
    fontSize: 14,
    color: "#737373",
  },

  // Form
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#737373",
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
    paddingVertical: 14,
    fontSize: 16,
    color: "#F5F5F5",
  },

  // Crew button (blue)
  crewButton: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    backgroundColor: "rgba(59,130,246,0.1)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  crewButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#60A5FA",
    textTransform: "uppercase",
  },

  // Staff button (emerald)
  staffButton: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  staffButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#34D399",
    textTransform: "uppercase",
  },

  buttonDisabledOpacity: {
    opacity: 0.5,
  },
  buttonLoadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  // Error
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

  // Success
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
  crewName: {
    marginTop: 8,
    fontSize: 18,
    color: "#E5E5E5",
    fontWeight: "500",
  },
  roleBadge: {
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#34D399",
  },
  portalLoading: {
    marginTop: 16,
    fontSize: 14,
    color: "#737373",
  },

  monoText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
