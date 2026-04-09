import * as SecureStore from "expo-secure-store";

const CREW_TOKEN_KEY = "crew_portal_token";

export async function getCrewToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CREW_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setCrewToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CREW_TOKEN_KEY, token);
}

export async function clearCrewToken(): Promise<void> {
  await SecureStore.deleteItemAsync(CREW_TOKEN_KEY);
}
