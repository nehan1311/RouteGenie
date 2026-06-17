import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "routegenie.session";

async function canUseSecureStore() {
  if (Platform.OS === "web") return false;
  return SecureStore.isAvailableAsync();
}

export async function saveSession(session) {
  const value = JSON.stringify(session);

  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(SESSION_KEY, value);
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, value);
  }
}

export async function loadSession() {
  let value = null;

  if (await canUseSecureStore()) {
    value = await SecureStore.getItemAsync(SESSION_KEY);
  } else if (typeof window !== "undefined") {
    value = window.localStorage.getItem(SESSION_KEY);
  }

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession() {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}
