import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const API_URL =
  extra.API_URL ?? "https://spotless-scrubbers-api.vercel.app";
export const SUPABASE_URL =
  extra.SUPABASE_URL ?? "https://kcmbwstjmdrjkhxhkkjt.supabase.co";
export const SUPABASE_ANON_KEY =
  extra.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbWJ3c3RqbWRyamtoeGhra2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzU0MDYsImV4cCI6MjA4NTE1MTQwNn0.W-8q1Frms6Octc2YETZjK2_9lgpUm4tlIt7brMZ5ZX8";
