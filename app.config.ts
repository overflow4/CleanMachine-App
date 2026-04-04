import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Osiris Mobile",
  slug: "osiris-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  scheme: "osiris-mobile",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.osiris.mobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    package: "com.osiris.mobile",
    edgeToEdgeEnabled: true,
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: ["expo-router", "expo-secure-store", "expo-font"],
  extra: {
    API_URL: process.env.EXPO_PUBLIC_API_URL ?? "https://spotless-scrubbers-api.vercel.app",
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://kcmbwstjmdrjkhxhkkjt.supabase.co",
    SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbWJ3c3RqbWRyamtoeGhra2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzU0MDYsImV4cCI6MjA4NTE1MTQwNn0.W-8q1Frms6Octc2YETZjK2_9lgpUm4tlIt7brMZ5ZX8",
    eas: {
      projectId: "78a8b5e0-d787-4b2b-97b8-0f646597b6de",
    },
  },
  experiments: {
    typedRoutes: true,
  },
});
